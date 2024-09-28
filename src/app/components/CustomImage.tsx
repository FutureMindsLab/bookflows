import React from 'react'
import Image, { ImageProps } from 'next/image'

interface CustomImageProps extends Omit<ImageProps, 'src'> {
  src: string
}

export function CustomImage({ src, ...props }: CustomImageProps) {
  return (
    <Image 
      src={`/images/${src}`} 
      {...props} 
      alt={props.alt || 'Image'}
    />
  )
}