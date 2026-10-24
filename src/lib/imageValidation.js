export const MAX_IMAGE_BYTES=5*1024*1024
export function validateImage(file){
 const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
 if(!file||!extensions[file.type])throw new Error('Choose a JPG, PNG or WebP image. SVG and other files are not accepted.')
 if(file.size>MAX_IMAGE_BYTES)throw new Error('Image must be 5 MB or smaller.')
 if(file.size===0)throw new Error('The image is empty.')
 return extensions[file.type]
}
