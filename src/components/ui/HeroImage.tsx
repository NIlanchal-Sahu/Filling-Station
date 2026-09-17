import { useState } from 'react';
import { Box } from '@mui/material';

type Props = {
  webpSrc: string;
  fallbackSvg: string;
  alt?: string;
  sx?: object;
};

export function HeroImage({ webpSrc, fallbackSvg, alt = '', sx }: Props) {
  const [src, setSrc] = useState(webpSrc);

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setSrc(fallbackSvg)}
      sx={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...sx,
      }}
    />
  );
}
