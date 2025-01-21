// ExoQuery Feature - Allows one-time interactions with different AI models
import { TerminalFeature } from '../featureTypes';
import { Command } from '../../terminal/types/commands';
import { FeatherAgent } from 'feather-ai';
import { logger } from '../../utils/logger';

// Map model type shortcuts to their full model names
const MODEL_MAP = {
  'deepseek': 'deepseek/deepseek-r1',
  'claude': 'meta-llama/llama-3.3-70b-instruct' // replace this with claude later
} as const;

type ModelType = keyof typeof MODEL_MAP;

// Validate if provided model type is supported
const isValidModelType = (type: string): type is ModelType => {
  return type in MODEL_MAP;
};

// Command to query external AI models
const exoQueryCommand: Command = {
  name: 'exo-query',
  description: 'Query an external AI model (deepseek/claude) for one-time responses. Deepseek is a highly intelligent reasoning engine focused on step-by-step analysis and problem-solving. Claude is a highly empathetic and creative assistant focused on understanding and generating innovative ideas. Wrap both the model and query in quotes.',
  parameters: [
    {
      name: 'model',
      description: 'Model type to query (deepseek/claude)',
      type: 'string',
      required: true
    },
    {
      name: 'query',
      description: 'The query to send to the AI model. Wrap in quotes if it is a string.',
      type: 'string',
      required: true
    }
  ],
  handler: async ({ model, query }) => {
    // Validate model type
    if (!isValidModelType(model)) {
      return {
        output: `Error: Invalid model type. Supported types: ${Object.keys(MODEL_MAP).join(', ')}`
      };
    }

    try {
      // Create a one-time Feather agent with the specified model
      const agent = new FeatherAgent({
        model: MODEL_MAP[model],
        systemPrompt: model === 'deepseek' 
          ? 'Generate a response to the user\'s query'
          : 'Generate a response to the user\'s query',
      });

      // Get response from the agent
      const response = await agent.run(query);

      // Format the output
      return {
        output: `Your query: "${query}"\n\n${model}'s response:\n"""${response.output}"""\n\nNote: chat history is NOT saved. These messages are a one time use & response`
      };
    } catch (error) {
      logger.error('Error in exo-query command:', error);
      return { 
        output: 'Error: Failed to get response from AI model'
      };
    }
  }
};

// ExoQuery Feature implementation
const ExoQueryFeature: TerminalFeature = {
  async loadFeatureCommands(): Promise<Command[]> {
    return [exoQueryCommand];
  }
};

export default ExoQueryFeature;