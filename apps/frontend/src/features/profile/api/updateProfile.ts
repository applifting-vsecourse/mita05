import { api } from "@/lib/api-client"

import {
  profileSchema,
  type Profile,
  type ProfileUpdate,
} from "@/features/profile/api/profileSchemas"

export async function updateProfile(input: ProfileUpdate): Promise<Profile> {
  const json = await api.put("profile", { json: input }).json()
  return profileSchema.parse(json)
}
