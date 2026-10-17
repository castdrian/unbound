/** The start of 2015 in Unix milliseconds: the zero point of Discord snowflake timestamps. */
export const DISCORD_EPOCH = 1_420_070_400_000n;

/**
 * @description Reads the creation time encoded in a Discord snowflake id.
 * @param id The snowflake, e.g. a Discord user id.
 * @returns When the object the id belongs to was created.
 */
export function getSnowflakeDate(id: string): Date {
	return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

export default { DISCORD_EPOCH, getSnowflakeDate };
