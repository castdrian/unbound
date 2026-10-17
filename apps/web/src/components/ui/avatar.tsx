import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { useState } from 'react';

import cn from '~/lib/cn';

const avatarVariants = cva(
	'flex items-center justify-center rounded-full drag-none text-center bg-accent shrink-0',
	{
		variants: {
			size: {
				xs: 'size-6 text-xs',
				sm: 'size-8 text-sm',
				md: 'size-10 text-md',
				lg: 'size-12 text-xl',
				xl: 'size-16 text-3xl',
				full: 'w-full h-full text-[clamp(1rem,25cqw,10rem)]',
			},
		},
		defaultVariants: {
			size: 'full',
		},
	},
);

type AvatarProps = Omit<ComponentProps<'img'>, 'src'> &
	VariantProps<typeof avatarVariants> & {
		src?: string | null;
		fallback?: string;
	};

function Avatar({ className, src, size, fallback = '?', ...props }: AvatarProps) {
	const [imageErrored, setImageErrored] = useState(false);

	if (imageErrored || !src) {
		return (
			<span {...props} data-slot='avatar' className={cn(avatarVariants({ size }), className)}>
				{fallback}
			</span>
		);
	}

	return (
		<img
			{...props}
			data-slot='avatar'
			src={src}
			className={cn(avatarVariants({ size }), className)}
			onError={() => setImageErrored(true)}
			loading='lazy'
			decoding='async'
		/>
	);
}

export type { AvatarProps };

export default Avatar;
