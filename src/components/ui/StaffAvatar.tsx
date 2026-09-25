import { Avatar } from '@mui/material';
import { staffInitials } from '@/utils/staffPhoto';

type Props = {
  name: string;
  photoUrl?: string;
  size?: number;
};

export function StaffAvatar({ name, photoUrl, size = 36 }: Props) {
  return (
    <Avatar
      src={photoUrl || undefined}
      alt={name}
      sx={{ width: size, height: size, fontSize: size * 0.38, fontWeight: 600 }}
    >
      {staffInitials(name)}
    </Avatar>
  );
}
