import type { CardProps, StackProps, SwitchProps, TextProps } from '@unbound-app/types/components';
import type { FlexAlignType, ViewStyle } from 'react-native';
import { Switch, Text, View } from 'react-native';

const ALIGN: Record<NonNullable<StackProps['align']>, FlexAlignType> = {
	start: 'flex-start',
	center: 'center',
	end: 'flex-end',
	stretch: 'stretch',
};

const JUSTIFY: Record<NonNullable<StackProps['justify']>, ViewStyle['justifyContent']> = {
	start: 'flex-start',
	center: 'center',
	end: 'flex-end',
	between: 'space-between',
	around: 'space-around',
};

/**
 * @description Unbound's stand-in for Discord's `Text`: plain React Native text with the same text props.
 * @param props The text props.
 * @returns The text element.
 */
export function FallbackText({
	children,
	style,
	numberOfLines,
	lineClamp,
	ellipsizeMode,
	allowFontScaling,
}: TextProps) {
	return (
		<Text
			style={style}
			numberOfLines={numberOfLines ?? lineClamp}
			ellipsizeMode={ellipsizeMode}
			allowFontScaling={allowFontScaling}
		>
			{children}
		</Text>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Heading`: bold React Native text.
 * @param props The text props.
 * @returns The heading element.
 */
export function FallbackHeading(props: TextProps) {
	return <FallbackText {...props} style={[{ fontWeight: '700' }, props.style]} />;
}

/**
 * @description Unbound's stand-in for Discord's `FormSwitch`: React Native's switch.
 * @param props The switch props.
 * @returns The switch element.
 */
export function FallbackSwitch({
	value,
	disabled,
	accessibilityLabel,
	onValueChange,
}: SwitchProps) {
	return (
		<Switch
			value={value}
			disabled={disabled}
			accessibilityLabel={accessibilityLabel}
			onValueChange={onValueChange}
		/>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Stack`: a view laying its children out with even spacing.
 * @param props The stack props.
 * @returns The stack element.
 */
export function FallbackStack({
	spacing = 8,
	direction = 'vertical',
	align,
	justify,
	style,
	children,
	...rest
}: StackProps) {
	return (
		<View
			{...rest}
			style={[
				{
					flexDirection: direction === 'horizontal' ? 'row' : 'column',
					gap: spacing,
					alignItems: align ? ALIGN[align] : undefined,
					justifyContent: justify ? JUSTIFY[justify] : undefined,
				},
				style,
			]}
		>
			{children}
		</View>
	);
}

/**
 * @description Unbound's stand-in for Discord's `Card`: a padded, rounded view.
 * @param props The card props.
 * @returns The card element.
 */
export function FallbackCard({
	radius = 16,
	style,
	children,
	variant: _variant,
	border: _border,
	shadow: _shadow,
	start: _start,
	end: _end,
	...rest
}: CardProps) {
	return (
		<View {...rest} style={[{ padding: 16, borderRadius: radius, overflow: 'hidden' }, style]}>
			{children}
		</View>
	);
}
