import { SiX } from '@icons-pack/react-simple-icons';
import { AudioWaveformIcon, FileIcon, VideoIcon } from 'lucide-react';

import { CodeIcon, ImageIcon, TextIcon } from 'lucide-react';

export const nodeButtons = [
  {
    id: 'text',
    label: 'text',
    icon: TextIcon,
  },
  {
    id: 'image',
    label: 'image',
    icon: ImageIcon,
  },
  {
    id: 'audio',
    label: 'audio',
    icon: AudioWaveformIcon,
  },
  {
    id: 'video',
    label: 'video',
    icon: VideoIcon,
  },
  {
    id: 'code',
    label: 'code',
    icon: CodeIcon,
    data: {
      content: { language: 'javascript' },
    },
  },
  {
    id: 'file',
    label: 'file',
    icon: FileIcon,
  },
  {
    id: 'tweet',
    label: 'tweet',
    icon: SiX,
  },
];
