import { Command, CommandHandler } from '../../../terminal/types/commands';
import { notesSubCommands } from './subCommandsRegistry';

const formatParamString = (param: { name: string; required: boolean }) => {
  return param.required ? `<${param.name}>` : `[${param.name}]`;
};

export const notes: Command = {
  name: 'notes',
  description: 'Manage personal notes. Use "notes help" for sub-commands.',
  parameters: [
    {
      name: 'subcommand',
      description: 'Sub-command to run, or "help"',
      required: false,
      type: 'string'
    },
    {
      name: 'args',
      description: 'Arguments for the sub-command (remaining tokens)',
      required: false,
      type: 'string'
    }
  ],
  handler: (async (args: { [key: string]: any }): Promise<{ output: string }> => {
    const subcommand = args.subcommand;
    const parsedArgs = Array.isArray(args.args) ? args.args : [];

    // Show help for specific subcommand
    if (subcommand === 'help' && parsedArgs.length > 0) {
      const cmdName = parsedArgs[0];
      const cmd = notesSubCommands.find(sc => sc.name === cmdName);

      if (!cmd) {
        return { output: `Unknown notes sub-command: ${cmdName}. Try "notes help" to see available commands.` };
      }

      const paramString = cmd.parameters?.map(formatParamString).join(' ') || '';
      const helpLines = [
        `Command: notes ${cmd.name}`,
        `Description: ${cmd.description}`,
        '',
        'Usage:',
        `  notes ${cmd.name} ${paramString}`,
        ''
      ];

      if (cmd.parameters && cmd.parameters.length > 0) {
        helpLines.push('Parameters:');
        for (const param of cmd.parameters) {
          const required = param.required ? '(Required)' : '(Optional)';
          const defaultVal = param.defaultValue ? ` [default: ${param.defaultValue}]` : '';
          const typeInfo = param.type ? ` <${param.type}>` : '';
          helpLines.push(`  ${param.name}${typeInfo}: ${param.description} ${required}${defaultVal}`);
        }
      }
      return { output: helpLines.join('\n') };
    }

    // Show general help if no subcommand or "help"
    if (!subcommand || subcommand === 'help') {
      const lines = [
        'Available "notes" sub-commands:',
        '(Use "notes help <command>" for detailed parameter info)',
        ''
      ];
      for (const sc of notesSubCommands) {
        const paramString = sc.parameters?.map(formatParamString).join(' ') || '';
        const cmdString = `${sc.name} ${paramString}`.padEnd(30);
        lines.push(`${cmdString} - ${sc.description}`);
      }
      return { output: lines.join('\n') };
    }

    // Find the matching subcommand
    const cmd = notesSubCommands.find(sc => sc.name === subcommand);
    if (!cmd) {
      return { output: `Unknown notes sub-command: ${subcommand}. Try "notes help".` };
    }

    // Parse arguments
    const paramValues: Record<string, any> = {};
    if (cmd.parameters && cmd.parameters.length > 0) {
      let tokenIndex = 0;
      for (let i = 0; i < cmd.parameters.length; i++) {
        const param = cmd.parameters[i];
        let value: any;
        const isLastParam = i === cmd.parameters.length - 1;

        if (isLastParam && param.required && (param.type === 'string' || !param.type)) {
          value = parsedArgs.slice(tokenIndex).join(' ');
        } else {
          value = parsedArgs[tokenIndex++];
          if (!value && param.required) {
            throw new Error(`Missing required parameter: ${param.name}`);
          }
        }

        // Convert type
        if (param.type === 'number' && value !== undefined) {
          const numVal = Number(value);
          if (isNaN(numVal)) {
            throw new Error(`Parameter '${param.name}' must be a number.`);
          }
          value = numVal;
        }

        paramValues[param.name] = value;
      }
    }

    // Run the handler
    try {
      const result = await cmd.handler(paramValues);
      return result || { output: 'Command completed successfully.' };
    } catch (error) {
      return {
        output: `❌ Error executing subcommand "${subcommand}": ${error}`
      };
    }
  }) as CommandHandler
};