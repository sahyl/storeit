"use server"

import { ID, Models, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite"
import {InputFile} from "node-appwrite/file"
import { appwriteConfig } from "../appwrite/config";
import { constructFileUrl, getFileType, parseStringify } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentuser } from "./user.actions";


const handleErrror = (error: unknown, message: string) => {
    console.log(error, message);
    throw error;
  };

export const uploadFile = async ({file , ownerId , accountId ,path}:UploadFileProps)=>{
    const {storage , databases } = await createAdminClient()
    try {
        const inputFile = InputFile.fromBuffer(file,file.name)

        const bucketFile = await storage.createFile(
            appwriteConfig.bucketId,
            ID.unique(),
            inputFile,
        )

        const fileDocument = {
            type:getFileType(bucketFile.name).type,
            name:bucketFile.name,
            url:constructFileUrl(bucketFile.$id),
            extension : getFileType(bucketFile.name).extension,
            size:bucketFile.sizeOriginal,
            owner:ownerId,
            accountId,
            users:[],
            bucketFileId:bucketFile.$id,
        }

        const newFile = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.filesCollectionId,
            ID.unique(),
            fileDocument
        )
        .catch(async (error:unknown)=>{
            await storage.deleteFile(appwriteConfig.bucketId,bucketFile.$id)
            handleErrror(error,"Failed to  create file document")
        })

        revalidatePath(path)
        return parseStringify(newFile)

    } catch (error) {
        handleErrror(error, "Failed to upload file");
        
    }

}

const createQueries = (currentuser:Models.Document,types:string[],searchText:string , sort:string , limit?:number)=>{
    const queries  =  [
        Query.or([
            Query.equal("owner", [currentuser.$id]),
            Query.contains("users", [currentuser.email])

        ])
        
    ]

    if (types.length >0) queries.push(Query.equal("type",types))
    if (searchText) queries.push(Query.contains("name",searchText))
    if (limit) queries.push(Query.limit(limit))
    if (sort){
        const [sortBy , orderBy] = sort.split("-")
    queries.push(orderBy ==='asc' ? Query.orderAsc(sortBy): Query.orderDesc(sortBy))
    }
    


    return queries
}



export const getFiles = async ({types=[],searchText ='',sort = '$createdAt-desc', limit}:GetFilesProps)=>{
    const {databases} = await createAdminClient()
    try {
        const currentUser = await getCurrentuser()

        if (!currentUser) throw new Error("No user found");

        const queries = createQueries(currentUser,types,searchText,sort ,limit)

        const files = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.filesCollectionId,
            queries
        )
        return parseStringify(files)
        
    } catch (error) {
        handleErrror(error,"Failed to get files")
    }
}

export const renameFile =  async({fileId, name , extension , path}: RenameFileProps)=>{
    const {databases} = await createAdminClient()
    try {
        const newName = `${name}.${extension}`
        const updatedFile = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.filesCollectionId,
            fileId,
            {
                name:newName
            }
        )
        revalidatePath(path)
        return parseStringify(updatedFile)
    } catch (error) {
        handleErrror(error,"Failed to rename file")
    }

}



export const updateFileUsers =  async({fileId, emails ,path}: UpdateFileUsersProps)=>{
    const {databases} = await createAdminClient()
    try {
        
        const updatedFile = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.filesCollectionId,
            fileId,
            {
                users: emails
            }
        )
        revalidatePath(path)
        return parseStringify(updatedFile)
    } catch (error) {
        handleErrror(error,"Failed to update file users")
    }

}


export const deleteFile =  async({fileId, bucketFileId ,path}: DeleteFileProps)=>{
    const {databases, storage} = await createAdminClient()
    try {
        
        const deletedFile = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.filesCollectionId,
            fileId,
            
        )
        if (deletedFile){
            await storage.deleteFile(
                appwriteConfig.bucketId,
                bucketFileId
            )
        }
        revalidatePath(path)
        return parseStringify({status:"success"})
    } catch (error) {
        handleErrror(error,"Failed to update file users")
    }

}

export async function getTotalSpaceUsed() {
    try {
      const { databases } = await createSessionClient();
      const currentUser = await getCurrentuser();
      if (!currentUser) {
        console.error("No authenticated user found");
        throw new Error("User is not authenticated.");
      }
  
      console.log("Current user ID:", currentUser.$id);
  
      const files = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.filesCollectionId,
        [Query.equal("owner", [currentUser.$id])],
      );
  
      console.log("Number of files found:", files.documents.length);
  
      const totalSpace = {
        image: { size: 0, latestDate: "" },
        document: { size: 0, latestDate: "" },
        video: { size: 0, latestDate: "" },
        audio: { size: 0, latestDate: "" },
        other: { size: 0, latestDate: "" },
        used: 0,
        all: 2 * 1024 * 1024 * 1024 /* 2GB available bucket storage */,
      };
  
      files.documents.forEach((file) => {
        const fileType = file.type as FileType;
        const typeToUse = totalSpace[fileType] ? fileType : 'other';
        
        if (typeToUse === 'other') {
          console.warn(`Unknown file type: ${fileType}, using 'other' category`);
        }
  
        totalSpace[typeToUse].size += file.size;
        totalSpace.used += file.size;
  
        if (
          !totalSpace[typeToUse].latestDate ||
          new Date(file.$updatedAt) > new Date(totalSpace[typeToUse].latestDate)
        ) {
          totalSpace[typeToUse].latestDate = file.$updatedAt;
        }
      });
  
      console.log("Total space used:", totalSpace.used);
      console.log("Total space available:", totalSpace.all);
      console.log("Usage percentage:", (totalSpace.used / totalSpace.all) * 100);
  
      return parseStringify(totalSpace);
    } catch (error) {
      console.error("Error in getTotalSpaceUsed:", error);
      handleErrror(error, "Error calculating total space used: ");
    }
  }
  
  