import { Command, CommandHandler } from '../../../terminal/types/commands';
import { twitterSubCommands } from './subCommandsRegistry';
import { ensureAuthenticated } from '../../../twitter/twitterClient';
import { logger } from '../../../utils/logger';

const formatParamString = (param: { name: string; required: boolean }) => {
  return param.required ? `<${param.name}>` : `[${param.name}]`;
};

export const twitter: Command = {
  name: 'twitter',
  description: 'Interact with Twitter environment. Use "twitter help" for sub-commands.',
  parameters: [
    {
      name: 'subcommand',
      description: 'Sub-command to run, or "help"',
      required: false,
      type: 'string'
    },
    {
      // This parameter will now be returned as an array by executeCommand.ts if defined as 'args'.
      // We'll treat it as array in our logic.
      name: 'args',
      description: 'Arguments for the sub-command (remaining tokens)',
      required: false,
      type: 'string' 
    }
  ],
  handler: (async (args: { [key: string]: any }): Promise<{ output: string; data?: any }> => {
    const subcommand = args.subcommand;
    // args.args is now an array if present, or undefined if not provided
    const parsedArgs = Array.isArray(args.args) ? args.args : [];

    logger.debug('Twitter command parsed args:', { subcommand, restArgs: parsedArgs });

    // Show detailed help for a specific subcommand
    if (subcommand === 'help' && parsedArgs.length > 0) {
      const cmdName = parsedArgs[0];
      const cmd = twitterSubCommands.find(sc => sc.name === cmdName);
      
      if (!cmd) {
        return { output: `Unknown sub-command: ${cmdName}. Try "twitter help" for available commands.` };
      }

      const paramString = cmd.parameters?.map(formatParamString).join(' ') || '';
      
      const helpText = [
        `Command: twitter ${cmd.name}`,
        `Description: ${cmd.description}`,
        '',
        'Usage:',
        `  twitter ${cmd.name} ${paramString}`,
        ''
      ];

      if (cmd.parameters && cmd.parameters.length > 0) {
        helpText.push('Parameters:');
        for (const param of cmd.parameters) {
          const required = param.required ? '(Required)' : '(Optional)';
          const defaultValue = param.defaultValue ? ` [default: ${param.defaultValue}]` : '';
          const type = param.type ? ` <${param.type}>` : '';
          helpText.push(`  ${param.name}${type}: ${param.description} ${required}${defaultValue}`);
        }
      }

      return { output: helpText.join('\n') };
    }

    // Show general help
    if (!subcommand || subcommand === 'help') {
      const helpText = [
        'Available Twitter sub-commands:',
        '(Use "twitter help <command>" for detailed parameter information)',
        ''
      ];
      
      for (const sc of twitterSubCommands) {
        const paramString = sc.parameters?.map(formatParamString).join(' ') || '';
        const cmdString = `${sc.name} ${paramString}`.padEnd(25);
        helpText.push(`${cmdString} - ${sc.description}`);
      }
      
      return { output: helpText.join('\n') };
    }

    const cmd = twitterSubCommands.find(sc => sc.name === subcommand);
    if (!cmd) {
      return { output: `Unknown twitter sub-command: ${subcommand}. Try "twitter help".` };
    }

    try {
      await ensureAuthenticated();
      const paramValues: Record<string, any> = {};
      if (cmd.parameters && cmd.parameters.length > 0) {
        let tokenIndex = 0;
        for (let i = 0; i < cmd.parameters.length; i++) {
          const param = cmd.parameters[i];
          let value: any;
          const isLastParam = i === cmd.parameters.length - 1;

          if (isLastParam && param.required && (param.type === 'string' || !param.type)) {
            // Aggregate all leftover tokens if needed
            value = parsedArgs.slice(tokenIndex).join(' ');
          } else {
            value = parsedArgs[tokenIndex++];
            if (!value && param.required) {
              throw new Error(`Missing required parameter: ${param.name}`);
            }
          }

          // Type conversion
          if (param.type && value !== undefined) {
            switch (param.type) {
              case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                  throw new Error(`Parameter '${param.name}' must be a number`);
                }
                value = num;
                break;
              case 'boolean':
                value = value === 'true' || value === true;
                break;
            }
          }

          paramValues[param.name] = value;
        }
      }

      const result = await cmd.handler(paramValues);
      return result || { output: 'Command completed successfully' };
    } catch (error) {
      return {
        output: `❌ Authentication or Parsing Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }) as CommandHandler
};