## Features (Adding New Commands to TerminalCore)

Features are modules that add new commands (terminal actions) to the agent's environment. This allows the agent to perform additional actions beyond tool calls. Features are especially useful when running the agent through `TerminalCore`, enabling a richer set of actions the agent can autonomously perform.

**How to Add a Feature**:  
- Create a new `.ts` file in `src/features/` that exports a `TerminalFeature`.  
- Implement a `loadFeatureCommands()` method that returns an array of `Command` objects.
- Each `Command` defines a name, description, parameters, and a handler function.
- Add the feature to the `features` array when initializing `TerminalCore`.

**Example**:
```typescript
// src/features/myNewFeature.ts
import { TerminalFeature } from './featureTypes';
import { Command } from '../terminal/types/commands';

const myCustomCommand: Command = {
  name: 'say-hello',
  description: 'Print a greeting message.',
  parameters: [],
  handler: async () => {
    return { output: 'Hello from my new feature!' };
  },
};

const MyNewFeature: TerminalFeature = {
  async loadFeatureCommands(): Promise<Command[]> {
    return [myCustomCommand];
  }
};

export default MyNewFeature;
```

Then, register this feature in `TerminalCore`:
```typescript
import MyNewFeature from './src/features/myNewFeature';
import { TerminalCore } from './src/terminal/terminalCore';

const core = new TerminalCore({
  features: [MyNewFeature],
});

await core.init();
await core.runLoop();
```

Now the agent can execute the `say-hello` command autonomously if needed.

## FEATURES THAT COME WITH THE PACKAGE

- **InternetFeature**: allows the agent to search the internet. REQUIRES PERPLEXITY API KEY in .env
- **TwitterFeature**: full twitter package for the agent. REQUIRES SUPABASE DB to be setup and twitter login set in the .env
(see docs/database.md for supabase SQL setup)
- **ExoQueryFeature**: enables one-time AI model interactions through the terminal. Supports two specialized models:
  - `exo-query "deepseek" "query"` - Uses deepseek-r1 for complex reasoning and problem-solving
  - `exo-query "claude" "query"` - Uses Claude 3.5 Sonnet for creative and empathetic responses
  Note: These queries are stateless - chat history is not preserved between commands.