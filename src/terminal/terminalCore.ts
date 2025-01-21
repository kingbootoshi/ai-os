import { FeatherAgent, indentNicely } from 'feather-ai';
import { logger } from '../utils/logger';
import { getCurrentTimestamp } from '../utils/formatTimestamps';
import { executeCommand } from './executeCommand';
import { EventEmitter } from 'events';
import { registerCommands, generateHelpText } from './commandRegistry';

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
    logger.debug({ args }, "Executing terminal command");
    try {
      const result = await executeCommand(args.command);
      return { result: result.output };
    } catch (error) {
      logger.error({ error, args }, "Terminal command execution error");
      throw error;
    }
  }
};

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

  public async init() {
    // Load feature commands
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
      chainRun: false, // Disable chain running - we'll handle it ourselves
      autoExecuteTools: false, // Disable auto-execution
      forceTool: true, // Force the agent to use terminalCommandTool
      debug: true, // Enable debug GUI
      dynamicVariables: {
        terminal_commands: () => generateHelpText(),
        current_timestamp: () => getCurrentTimestamp(),
        personality: () => this.options.personality || "You are a helpful terminal assistant",
        additional_dynamic_variables: () => Object.values(this.dynamicVariables)
          .join('\n\n')
      }
    });

    logger.info('TerminalCore initialized with FeatherAgent and features');
  }

  /**
   * Parses and validates the function call from agent output
   * Returns parsed arguments or throws error if invalid
   */
  private parseFunctionCall(functionCall: { functionName: string, functionArgs: any }) {
    // Validate function name matches our tool
    if (functionCall.functionName !== 'execute_terminal_command') {
      throw new Error(`Invalid function name: ${functionCall.functionName}`);
    }

    // Parse arguments - handle both string and object formats
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

    // Validate required fields
    const requiredFields = ['thought', 'plan', 'command'];
    for (const field of requiredFields) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return args;
  }

  public async runLoop() {
    logger.info('Starting TerminalCore run loop');

    while (true) {
      this.actionCount = 0;
      while (this.actionCount < this.maxActions) {
        // Run the agent - it will return a function call since forceTool is true
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
          // Parse and validate the function call
          const parsedArgs = this.parseFunctionCall(agentResult.functionCalls[0]);
          
          // Log the agent's thought process
          logger.info({
            thought: parsedArgs.thought,
            plan: parsedArgs.plan
          }, 'Agent reasoning');
          
          // Execute the terminal command
          const result = await terminalCommandTool.execute(parsedArgs);
          
          // Add the command output back as a user message with timestamp
          const userMessage = `${getCurrentTimestamp()} - [TERMINAL LOG]\n\n${result.result}`;
          this.agent.addUserMessage(userMessage);

          // Format the agent's thought process and command into a structured message
          const assistantMessage = `[THOUGHT]\n ${parsedArgs.thought}\n\n[PLAN]\n ${parsedArgs.plan}\n\n[COMMAND]\n ${parsedArgs.command}`;

          logger.info({
            assistantMessage: assistantMessage,
            userMessage: userMessage
          }, 'Loop iteration');

          // Emit loop iteration event with agent output
          this.emit('loop:iteration', {
            assistantMessage: assistantMessage,
            userMessage: userMessage
          }); 

          logger.info('Loop iteration complete');

        } catch (error) {
          logger.error({ error }, 'Error processing agent command');
          // Feed error back to the agent as user message
          this.agent.addUserMessage(`Error executing command: ${error.message}`);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, this.actionCooldownMs));
        this.actionCount++;
      }

      // Emit max actions reached event
      this.emit('loop:maxActions', []);

      // Enter idle mode
      const idleMinutes = Math.floor(Math.random() * (60 - 30 + 1)) + 30;
      logger.info(`Entering idle mode for ${idleMinutes} minutes`);
      await new Promise((resolve) => setTimeout(resolve, idleMinutes * 60 * 1000));
      logger.info('Resuming active mode');
    }
  }
}