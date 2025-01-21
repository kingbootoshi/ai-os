import { parse } from 'shell-quote';
import { getAllCommands, getCommand } from './commandRegistry';
import { logTerminalOutput } from './terminalLogger';
import type { CommandParameter } from './types/commands';
import { logger } from '../utils/logger';
/**
 * Parses argument tokens into named parameters based on parameter definitions.
 * Modified: If the parameter name is 'args' and it's the last parameter, we store all leftover tokens as an array.
 * Otherwise, if it's the last required string param, we aggregate leftover tokens into a single string.
 */
function parseArguments(
  tokens: string[],
  parameters: CommandParameter[]
): { [key: string]: any } {
  const args: { [key: string]: any } = {};
  let tokenIndex = 0;

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    let value: any;

    const isLastParam = i === parameters.length - 1;

    // If this is the last param and param.name === 'args', store leftover tokens as an array
    if (isLastParam && param.name === 'args') {
      const leftoverTokens = tokens.slice(tokenIndex);
      // Store them directly as an array
      args[param.name] = leftoverTokens;
      break;
    }

    // If this is the last param, required, and string, aggregate all leftover tokens
    if (isLastParam && param.required && (param.type === 'string' || !param.type)) {
      const leftoverTokens = tokens.slice(tokenIndex);
      value = leftoverTokens.join(' ');
      args[param.name] = value;
      break;
    }

    if (tokenIndex < tokens.length) {
      value = tokens[tokenIndex++];
    } else if (param.required) {
      throw new Error(`Missing required parameter: ${param.name}`);
    } else if (param.defaultValue !== undefined) {
      value = param.defaultValue;
    }

    // Type conversion
    if (param.type && value !== undefined) {
      switch (param.type) {
        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            throw new Error(`Parameter '${param.name}' must be a number.`);
          }
          value = num;
          break;
        case 'boolean':
          value = value === 'true' || value === true;
          break;
      }
    }

    args[param.name] = value;
  }

  return args;
}

function preprocessCommandLine(commandLine: string): string {
  return commandLine;
}

export async function executeMultipleCommands(
  commands: { command: string }[]
): Promise<{
  commands: string[];
  output: string;
}> {
  const outputs: string[] = [];
  const executedCommands: string[] = [];

  for (const cmd of commands) {
    const result = await executeCommand(cmd.command);
    outputs.push(result.output);
    executedCommands.push(result.command);
  }

  const bundledOutput = executedCommands.map((cmd, index) => 
    `$ ${cmd}\n${outputs[index]}`
  ).join('\n\n');

  return {
    commands: executedCommands,
    output: bundledOutput
  };
}

export async function executeCommand(
  commandLine: string
): Promise<{
  command: string;
  output: string;
}> {
  if (!commandLine) {
    const output = 'Error: No command provided';
    logger.info(output);
    logTerminalOutput(commandLine, output);
    return {
      command: '',
      output,
    };
  }

  const processedCommand = preprocessCommandLine(commandLine.trim());
  const tokens = parse(processedCommand);
  
  const unescapedTokens = tokens.map(token => 
    typeof token === 'string' ? token.replace(/\\\$/g, '$') : token
  );

  const commandToken = unescapedTokens[0];
  const commandName = typeof commandToken === 'string' ? commandToken : '';
  const argsTokens = unescapedTokens.slice(1).filter((token): token is string => typeof token === 'string');

  const command = getCommand(commandName);

  if (command) {
    try {
      let args: { [key: string]: any } = {};

      if (command.parameters && command.parameters.length > 0) {
        args = parseArguments(argsTokens as string[], command.parameters);
      }

      const result = await command.handler(args);
      logTerminalOutput(commandLine, result.output);
      return {
        command: commandLine,
        output: result.output,
      };
    } catch (error: unknown) {
      const output = `Error executing command '${commandName}': ${(error as Error).message || error}`;
      logTerminalOutput(commandLine, output);
      return {
        command: commandLine,
        output,
      };
    }
  } else {
    const output = `Unknown command: ${commandName}`;
    logTerminalOutput(commandLine, output);
    return {
      command: commandLine,
      output,
    };
  }
}