import { Command } from './types/commands';

const commandRegistry: Map<string, Command> = new Map();

/**
 * Allows manual registration of commands from various sources (core features, external features)
 */
export function registerCommands(commands: Command[]) {
  for (const cmd of commands) {
    if (cmd && cmd.name) {
      commandRegistry.set(cmd.name, cmd);
    } else {
      console.warn(`Invalid command attempted to register: ${cmd ? cmd.name : 'unknown'}`);
    }
  }
}

export function getCommand(commandName: string): Command | undefined {
  return commandRegistry.get(commandName);
}

export function getAllCommands(): Command[] {
  return Array.from(commandRegistry.values());
}

export function generateHelpText(): string {
  const commands = getAllCommands();
  const helpText: string[] = ['Available commands:'];

  const formatCommand = (cmd: Command) => {
    let cmdStr = cmd.name;
    if (cmd.parameters?.length) {
      cmdStr += ' ' + cmd.parameters
        .map(p => `<${p.name}>`)
        .join(' ');
    }
    
    const paddedCmd = cmdStr.padEnd(25, ' ');
    return `${paddedCmd} - ${cmd.description}`;
  };

  commands.forEach(cmd => {
    helpText.push(formatCommand(cmd));
  });

  return helpText.join('\n');
}