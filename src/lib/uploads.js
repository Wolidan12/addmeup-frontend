import {supabase} from './supabase'
import {validateImage} from './imageValidation'
export async function uploadImage(bucket,folder,file){
 const ext=validateImage(file),path=`${folder}/${crypto.randomUUID()}.${ext}`
 const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false})
 if(error)throw error
 return {path,url:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}
}
