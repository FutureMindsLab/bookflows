import React from 'react'

interface AvatarProps {
  children?: React.ReactNode
  className?: string
}

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt?: string
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt, ...props }) => (
  <img src={src} alt={alt} className="h-full w-full object-cover" {...props} />
)

const AvatarFallback: React.FC<AvatarFallbackProps> = ({ children, ...props }) => (
  <div
    className="flex h-full w-full items-center justify-center bg-purple-500 text-white text-sm font-medium uppercase"
    {...props}
  >
    {children}
  </div>
)

interface AvatarComponent extends React.FC<AvatarProps> {
  Image: typeof AvatarImage
  Fallback: typeof AvatarFallback
}

const Avatar: AvatarComponent = ({ children, className = '' }) => {
  return (
    <div className={`relative inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-600 ${className}`}>
      {children}
    </div>
  )
}

Avatar.Image = AvatarImage
Avatar.Fallback = AvatarFallback

export default Avatar