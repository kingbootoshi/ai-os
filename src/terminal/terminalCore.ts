import { FeatherAgent, indentNicely } from 'feather-ai';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/formatTimestamps';
import { executeCommand } from './executeCommand';
import { EventEmitter } from 'events';
import { registerCommands, generateHelpText } from './commandRegistry';

// supabase logic for storing messages / status
import {
  storeTerminalMessage,
  clearShortTermHistory
} from '../supabase/functions/terminal/terminalHistory';
import {
  createTerminalEntry,
  updateTerminalResponse,
  updateTerminalStatus
} from '../supabase/functions/terminal/terminalEntries';

interface Feature {
  loadFeatureCommands: () => Promise<any[]>;
}

interface TerminalCoreOptions {
  agentName?: string;
  personality?: string;
  model?: string;
  maxActions?: number;
  actionCooldownMs?: number;
  features?: Feature[];
}

export interface TerminalCoreEvents {
  'loop:iteration': (messages: { userMessage?: { content?: string }, assistantMessage?: { content?: string } }) => Promise<void> | void;
  'loop:maxActions': (fullHistory: any[]) => Promise<void> | void;
}

// Define the terminal command tool
const terminalCommandTool = {
  type: "function" as const,
  function: {
    name: "execute_terminal_command",
    description: "Execute a terminal command and get its output. First think about what you want to do, then plan how to execute it efficiently, then execute the command.",
    parameters: {
      type: "object",
      properties: {
        thought: {
          type: "string", 
          description: "Think about what you want to do and its implications"
        },
        plan: {
          type: "string",
          description: "Plan how to execute the command efficiently"
        },
        command: {
          type: "string",
          description: "The terminal command to execute"
        }
      },
      required: ["thought", "plan", "command"]
    }
  },
  async execute(args: Record<string, any>): Promise<{ result: string }> {
    try {
      const result = await executeCommand(args.command);
      return { result: result.output };
    } catch (error) {
      logger.error({ error, args }, "Terminal command execution error");
      throw error;
    }
  }
};

export class TerminalCore extends EventEmitter {
  private agent!: FeatherAgent;
  private sessionId: string;
  private maxActions: number;
  private actionCooldownMs: number;
  private features: Feature[];
  private actionCount: number = 0;
  private dynamicVariables: { [key: string]: string } = {};

  constructor(
    private options: TerminalCoreOptions = {}
  ) {
    super();
    // initial random sessionId – will be overridden on runLoop()
    this.sessionId = Math.random().toString(36).slice(2);
    this.maxActions = options.maxActions ?? 20;
    this.actionCooldownMs = options.actionCooldownMs ?? 120_000;
    this.features = options.features ?? [];
  }

  public setDynamicVariables(vars: Record<string, string>) {
    this.dynamicVariables = {
      ...this.dynamicVariables,
      ...vars
    };
  }

  /**
   * Parses and validates the function call from agent output
   * Returns parsed arguments or throws error if invalid
   */
  private parseFunctionCall(functionCall: { functionName: string, functionArgs: any }) {
    if (functionCall.functionName !== 'execute_terminal_command') {
      throw new Error(`Invalid function name: ${functionCall.functionName}`);
    }

    let args: Record<string, any>;
    if (typeof functionCall.functionArgs === 'string') {
      try {
        args = JSON.parse(functionCall.functionArgs);
      } catch (e) {
        throw new Error('Failed to parse function arguments as JSON');
      }
    } else {
      args = functionCall.functionArgs;
    }

    const requiredFields = ['thought', 'plan', 'command'];
    for (const field of requiredFields) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return args;
  }

  /**
   * Main loop that runs until maxActions reached, then enters idle mode
   */
  public async runLoop() {
    // Load feature commands and initialize agent
    for (const feature of this.features) {
      const cmds = await feature.loadFeatureCommands();
      registerCommands(cmds);
    }

    // Initialize FeatherAgent with proper configuration
    this.agent = new FeatherAgent({
      agentId: this.options.agentName || "terminalAgent",
      model: this.options.model || "openai/gpt-4o",
      systemPrompt: indentNicely`
      {{personality}}
      
      ## CORE TERMINAL FUNCTIONALITY
      You are connected to a terminal and can execute commands and manage system operations.
      You have access to terminal commands and can execute them to accomplish tasks.
      You should think carefully about what commands to execute and their potential impact.

      ## AVAILABLE TERMINAL COMMANDS - YOU ONLY HAVE ACCESS TO THESE COMMANDS, NOTE: Some commands have sub-commands which you must call with 'help'
      {{terminal_commands}}

      ## Current Timestamp: 
      {{current_timestamp}}

      {{additional_dynamic_variables}}

      ## OUTPUT FORMAT
      Use your execute_terminal_command tool to execute commands. You MUST use this tool.`,
      tools: [terminalCommandTool],
      chainRun: false, // We'll handle iteration ourselves
      autoExecuteTools: false, // We'll manually handle function calls
      forceTool: true,         // Force the agent to use terminalCommandTool every time
      debug: true,             // Enable debug GUI
      dynamicVariables: {
        terminal_commands: () => generateHelpText(),
        current_timestamp: () => getCurrentTimestamp(),
        personality: () => this.options.personality || "You are a helpful terminal assistant",
        additional_dynamic_variables: () => Object.values(this.dynamicVariables)
          .join('\n\n')
      }
    });

    logger.info('TerminalCore initialized with FeatherAgent and features');

    // Start with fresh sessionId each run
    this.sessionId = crypto.randomUUID();
    // Mark terminal active
    await updateTerminalStatus(true);
    logger.info(`Starting TerminalCore run loop with sessionId=${this.sessionId}`);

    while (true) {
      this.actionCount = 0;
      while (this.actionCount < this.maxActions) {
        // Run the agent once
        const agentResult = await this.agent.run();
        if (!agentResult.success) {
          logger.error('Agent run failed:', agentResult.error);
          break;
        }

        if (!agentResult.functionCalls?.length) {
          logger.error('Agent did not return any function calls');
          break;
        }

        try {
          const parsedArgs = this.parseFunctionCall(agentResult.functionCalls[0]);
          logger.info({ parsedArgs }, 'Parsed function call arguments');

          // Step 1: Insert a new row into terminal_history for the agent's thought, plan, and command
          const entryId = await createTerminalEntry(
            this.sessionId,
            {
              internal_thought: parsedArgs.thought,
              plan: parsedArgs.plan,
              terminal_commands: [{ command: parsedArgs.command }]
            }
          );

          // The agent's "assistant" message
          const assistantMessage = `[THOUGHT]\n ${parsedArgs.thought}\n\n[PLAN]\n ${parsedArgs.plan}\n\n[COMMAND]\n ${parsedArgs.command}`;

          // Step 2: Execute the command and store the returned terminal log
          const commandResult = await terminalCommandTool.execute(parsedArgs);
          const userMessage = `[${getCurrentTimestamp()} - TERMINAL LOG]\n\n${commandResult.result}`;

          // Step 3: Update that same row's terminal_log with the userMessage
          if (entryId) {
            await updateTerminalResponse(entryId, userMessage);
          }

          // Save short-term history
          await storeTerminalMessage({ role: 'assistant', content: assistantMessage }, this.sessionId);
          await storeTerminalMessage({ role: 'user', content: userMessage }, this.sessionId);

          logger.info({ assistantMessage, userMessage }, 'Loop iteration complete');

          // Add the terminal output as the next user input for the agent
          this.agent.addUserMessage(userMessage);

          this.emit('loop:iteration', {
            assistantMessage: assistantMessage,
            userMessage: userMessage
          });

        } catch (error) {
          logger.error({ error }, 'Error processing agent command');
          // Feed error back to the agent
          this.agent.addUserMessage(`Error executing command: ${error.message}`);
          break;
        }

        // Action done
        this.actionCount++;
        // Sleep
        await new Promise((resolve) => setTimeout(resolve, this.actionCooldownMs));
      }

      // We have hit maxActions, so let's emit the event
      this.emit('loop:maxActions', []);

      // Clear short-term history at the end of the run
      await clearShortTermHistory();

      // Mark terminal inactive
      await updateTerminalStatus(false);

      logger.info(`Max actions reached or loop ended. sessionId=${this.sessionId} going idle...`);

      // Enter idle mode, then break or re-run (depending on design).
      // For now, let's break after one cycle.
      break;
    }
  }
}