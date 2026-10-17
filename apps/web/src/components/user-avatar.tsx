import type { AvatarProps } from '~/components/ui/avatar';
import Avatar from '~/components/ui/avatar';

type UserAvatarProps = Omit<AvatarProps, 'fallback'> & {
	/** The name whose first letter stands in when there is no image. */
	name: string;
};

function UserAvatar({ name, ...props }: UserAvatarProps) {
	return <Avatar fallback={name.at(0)?.toUpperCase()} {...props} />;
}

export default UserAvatar;
