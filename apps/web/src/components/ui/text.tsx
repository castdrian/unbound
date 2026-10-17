import type { ComponentPropsWithoutRef, ElementType } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

import cn from '~/lib/cn';

const textVariants = cva('', {
	variants: {
		variant: {
			'heading-xl': 'text-4xl font-bold tracking-tight lg:text-5xl',
			'heading-lg': 'text-3xl font-bold tracking-tight',
			'heading-md': 'text-2xl font-semibold tracking-tight',
			'heading-sm': 'text-xl font-semibold tracking-tight',
			'text-lg': 'text-lg',
			'text-md': 'text-base',
			'text-sm': 'text-sm',
			'text-xs': 'text-xs',
		},
		color: {
			normal: 'text-foreground',
			muted: 'text-muted-foreground',
			destructive: 'text-destructive',
		},
	},
	defaultVariants: {
		variant: 'text-md',
		color: 'normal',
	},
});

type TextVariants = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariants['variant']>;

type TextProps<T extends ElementType> = {
	as?: T;
} & Omit<ComponentPropsWithoutRef<T>, 'color'> &
	TextVariants;

const VARIANT_ELEMENTS: Record<TextVariant, ElementType> = {
	'heading-xl': 'h1',
	'heading-lg': 'h2',
	'heading-md': 'h3',
	'heading-sm': 'h4',
	'text-lg': 'p',
	'text-md': 'p',
	'text-sm': 'p',
	'text-xs': 'p',
};

function Text<T extends ElementType = 'p'>({
	as,
	variant = 'text-md',
	color,
	className,
	...props
}: TextProps<T>) {
	const Component = as ?? (variant ? VARIANT_ELEMENTS[variant] : 'p');

	return <Component className={cn(textVariants({ variant, color }), className)} {...props} />;
}

export type { TextProps, TextVariants };

export default Text;
