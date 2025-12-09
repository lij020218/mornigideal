import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'A.Ideal - AI 기반 개인 성장 OS',
        short_name: 'A.Ideal',
        description: 'AI와 함께하는 나만의 성장 러닝메이트',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    };
}
