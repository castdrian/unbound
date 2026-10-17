import type { z } from 'zod';

import type { ControllerClient } from './controller';

/**
 * One command definition feeds both surfaces: the CLI builds flags and positionals from its schema,
 * and the MCP server uses the schema as the tool's input schema.
 */

/** The shared runtime a command handler runs against: the bridge controller it evaluates through. */
export type CommandContext = { client: ControllerClient };

/** What a command handler returns: a success flag, human-readable text, and optional structured data. */
export type CommandOutput = { ok: boolean; text: string; data?: unknown };

/** A command usable from both the CLI and (when opted in) the MCP server. */
export type CommandDefinition<S extends z.ZodObject<z.ZodRawShape>> = {
	name: string;
	description: string;
	/** MCP ⊂ CLI: every MCP action is a CLI command; not every CLI command is an MCP tool. */
	surfaces: { cli: true; mcp: boolean };
	/** Used directly as the MCP inputSchema; the CLI adapter derives flags from its fields. */
	schema: S;
	/** Which schema fields the CLI presents as positionals; the rest become flags. */
	cli?: { positionals?: (keyof z.infer<S>)[] };
	handler: (input: z.infer<S>, context: CommandContext) => Promise<CommandOutput>;
};
