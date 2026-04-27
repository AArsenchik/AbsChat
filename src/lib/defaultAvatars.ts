export const DEFAULT_PROFILE_AVATAR = '/default-avatars/1-1-1.png'

export type DefaultAvatarOption = {
  id: string
  name: string
  collectionName: string | null
  imageUrl: string
}

export const DEFAULT_PROFILE_AVATAR_OPTIONS: DefaultAvatarOption[] = [
  {
    id: 'default-avatar:1-1-1',
    name: 'Default Avatar 1',
    collectionName: 'Default',
    imageUrl: '/default-avatars/1-1-1.png',
  },
  {
    id: 'default-avatar:1-1-2',
    name: 'Default Avatar 2',
    collectionName: 'Default',
    imageUrl: '/default-avatars/1-1-2.png',
  },
  {
    id: 'default-avatar:1-1-3',
    name: 'Default Avatar 3',
    collectionName: 'Default',
    imageUrl: '/default-avatars/1-1-3.png',
  },
  {
    id: 'default-avatar:1-1-4',
    name: 'Default Avatar 4',
    collectionName: 'Default',
    imageUrl: '/default-avatars/1-1-4.png',
  },
]
