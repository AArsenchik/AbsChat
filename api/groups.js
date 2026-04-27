import crypto from 'crypto'
import { getAuthAddress, getSupabaseAdmin } from './_utils.js'

const GROUP_PREFIX = 'group:'
const GROUP_ID_REGEX = /^group:[a-z0-9-]{8,}$/i
const ADDRESS_REGEX = /^0x[0-9a-f]{40}$/i
const MISSING_TABLE_CODE = '42P01'
const MISSING_TABLE_PATTERNS = [
  "could not find the table 'public.groups'",
  "could not find the table 'public.group_members'",
  'schema cache',
]

const json = (res, status, body) => {
  res.status(status).setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const normalizeAddress = (value) => String(value ?? '').trim().toLowerCase()

const normalizeGroupId = (value) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return GROUP_ID_REGEX.test(raw) ? raw : ''
}

const getQueryValue = (value) => {
  if (Array.isArray(value)) return value[0]
  return value
}

const normalizeAddressList = (items) => {
  const list = Array.isArray(items) ? items : []
  const next = []
  const seen = new Set()
  list.forEach((item) => {
    const normalized = normalizeAddress(item)
    if (!ADDRESS_REGEX.test(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    next.push(normalized)
  })
  return next
}

const normalizeAvatarUrl = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 2_000_000) return null
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
    return trimmed
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return null
}

const handleTableError = (res, error) => {
  const message = String(error?.message ?? '')
  const normalizedMessage = message.toLowerCase()
  const missingByPattern = MISSING_TABLE_PATTERNS.some((pattern) =>
    normalizedMessage.includes(pattern),
  )
  if (error?.code === MISSING_TABLE_CODE || missingByPattern) {
    json(res, 500, {
      error:
        'Group tables are missing in Supabase. Create public.groups and public.group_members from README SQL, then retry.',
    })
    return true
  }
  return false
}

const mapGroupName = (groupId, groupName) =>
  typeof groupName === 'string' && groupName.trim()
    ? groupName.trim()
    : `${GROUP_PREFIX}${groupId.slice(GROUP_PREFIX.length, GROUP_PREFIX.length + 6)}`

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    json(res, 500, { error: 'Supabase admin not configured' })
    return
  }
  const user = getAuthAddress(req)
  if (!user) {
    json(res, 401, { error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET') {
    const detailsGroupId = normalizeGroupId(getQueryValue(req.query?.id))
    if (detailsGroupId) {
      const { data: membershipRow, error: membershipError } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', detailsGroupId)
        .eq('member_address', user)
        .maybeSingle()
      if (membershipError) {
        if (handleTableError(res, membershipError)) return
        json(res, 500, { error: membershipError.message })
        return
      }
      if (!membershipRow) {
        json(res, 404, { error: 'Group not found' })
        return
      }

      const [groupResult, membersResult] = await Promise.all([
        supabase
          .from('groups')
          .select('id, name, avatar_url, created_by, created_at, updated_at')
          .eq('id', detailsGroupId)
          .maybeSingle(),
        supabase
          .from('group_members')
          .select('member_address, role, joined_at')
          .eq('group_id', detailsGroupId)
          .order('joined_at', { ascending: true }),
      ])
      if (groupResult.error) {
        if (handleTableError(res, groupResult.error)) return
        json(res, 500, { error: groupResult.error.message })
        return
      }
      if (membersResult.error) {
        if (handleTableError(res, membersResult.error)) return
        json(res, 500, { error: membersResult.error.message })
        return
      }
      if (!groupResult.data) {
        json(res, 404, { error: 'Group not found' })
        return
      }

      const members = (Array.isArray(membersResult.data) ? membersResult.data : []).map((row) => ({
        address: normalizeAddress(row.member_address),
        role: typeof row.role === 'string' ? row.role : 'member',
        joined_at: row.joined_at ?? null,
      }))

      json(res, 200, {
        data: {
          id: detailsGroupId,
          name: mapGroupName(detailsGroupId, groupResult.data.name),
          avatar_url:
            typeof groupResult.data.avatar_url === 'string'
              ? groupResult.data.avatar_url
              : null,
          created_by: normalizeAddress(groupResult.data.created_by ?? ''),
          created_at: groupResult.data.created_at ?? null,
          updated_at: groupResult.data.updated_at ?? groupResult.data.created_at ?? null,
          role: typeof membershipRow.role === 'string' ? membershipRow.role : 'member',
          member_count: members.length,
          members,
        },
      })
      return
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id, role, joined_at')
      .eq('member_address', user)
      .order('joined_at', { ascending: false })
    if (membershipError) {
      if (handleTableError(res, membershipError)) return
      json(res, 500, { error: membershipError.message })
      return
    }
    const memberships = Array.isArray(membershipRows) ? membershipRows : []
    const groupIds = Array.from(
      new Set(
        memberships
          .map((row) => normalizeGroupId(row.group_id))
          .filter(Boolean),
      ),
    )
    if (groupIds.length === 0) {
      json(res, 200, { data: [] })
      return
    }

    const [groupsResult, membersResult] = await Promise.all([
      supabase
        .from('groups')
        .select('id, name, avatar_url, created_by, created_at, updated_at')
        .in('id', groupIds),
      supabase.from('group_members').select('group_id').in('group_id', groupIds),
    ])

    if (groupsResult.error) {
      if (handleTableError(res, groupsResult.error)) return
      json(res, 500, { error: groupsResult.error.message })
      return
    }
    if (membersResult.error) {
      if (handleTableError(res, membersResult.error)) return
      json(res, 500, { error: membersResult.error.message })
      return
    }

    const groups = Array.isArray(groupsResult.data) ? groupsResult.data : []
    const members = Array.isArray(membersResult.data) ? membersResult.data : []
    const groupMap = new Map(groups.map((group) => [normalizeGroupId(group.id), group]))
    const memberCountByGroup = {}
    members.forEach((row) => {
      const groupId = normalizeGroupId(row.group_id)
      if (!groupId) return
      memberCountByGroup[groupId] = (memberCountByGroup[groupId] ?? 0) + 1
    })

    const roleByGroup = {}
    memberships.forEach((row) => {
      const groupId = normalizeGroupId(row.group_id)
      if (!groupId) return
      roleByGroup[groupId] = typeof row.role === 'string' ? row.role : 'member'
    })

    const result = groupIds.map((groupId) => {
      const group = groupMap.get(groupId)
      return {
        id: groupId,
        name: mapGroupName(groupId, group?.name),
        avatar_url: typeof group?.avatar_url === 'string' ? group.avatar_url : null,
        created_by: normalizeAddress(group?.created_by ?? ''),
        created_at: group?.created_at ?? null,
        updated_at: group?.updated_at ?? group?.created_at ?? null,
        role: roleByGroup[groupId] ?? 'member',
        member_count: memberCountByGroup[groupId] ?? 0,
      }
    })

    result.sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
    json(res, 200, { data: result })
    return
  }

  if (req.method === 'PATCH') {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const targetGroupId = normalizeGroupId(
      getQueryValue(req.query?.id) ?? body.id,
    )
    if (!targetGroupId) {
      json(res, 400, { error: 'Missing group id' })
      return
    }

    const { data: membershipRow, error: membershipError } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', targetGroupId)
      .eq('member_address', user)
      .maybeSingle()
    if (membershipError) {
      if (handleTableError(res, membershipError)) return
      json(res, 500, { error: membershipError.message })
      return
    }
    if (!membershipRow) {
      json(res, 404, { error: 'Group not found' })
      return
    }

    const { data: existingGroup, error: existingGroupError } = await supabase
      .from('groups')
      .select('id, name, avatar_url, created_by, created_at, updated_at')
      .eq('id', targetGroupId)
      .maybeSingle()
    if (existingGroupError) {
      if (handleTableError(res, existingGroupError)) return
      json(res, 500, { error: existingGroupError.message })
      return
    }
    if (!existingGroup) {
      json(res, 404, { error: 'Group not found' })
      return
    }

    const membershipRole = String(membershipRow.role ?? '').toLowerCase()
    const canEditGroup = membershipRole === 'owner' || membershipRole === 'admin'
    const canManageMembers = membershipRole === 'owner'

    if (!canEditGroup) {
      json(res, 403, { error: 'Only group admins can update group profile' })
      return
    }

    const patch = {}
    let hasPatch = false
    const addMembers = normalizeAddressList(body.addMembers)
    const memberRoleAddress = normalizeAddress(body.memberAddress)
    const memberRole =
      typeof body.memberRole === 'string' ? body.memberRole.trim().toLowerCase() : ''
    const removeMember = normalizeAddress(body.removeMember)

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      const nextName = String(body.name ?? '').trim()
      if (!nextName) {
        json(res, 400, { error: 'Missing group name' })
        return
      }
      if (nextName.length > 64) {
        json(res, 400, { error: 'Group name is too long' })
        return
      }
      patch.name = nextName
      hasPatch = true
    }

    if (Object.prototype.hasOwnProperty.call(body, 'avatarUrl')) {
      if (body.avatarUrl === null || body.avatarUrl === '') {
        patch.avatar_url = null
        hasPatch = true
      } else {
        const avatarUrl = normalizeAvatarUrl(body.avatarUrl)
        if (!avatarUrl) {
          json(res, 400, { error: 'Invalid group avatar' })
          return
        }
        patch.avatar_url = avatarUrl
        hasPatch = true
      }
    }

    const membersToInsert = addMembers.filter((memberAddress) => memberAddress !== user)
    const needsExistingMembers =
      membersToInsert.length > 0 || Boolean(memberRoleAddress && memberRole) || Boolean(removeMember)
    let existingMembers = []

    if (needsExistingMembers) {
      const { data: rows, error: existingMembersError } = await supabase
        .from('group_members')
        .select('member_address, role, joined_at')
        .eq('group_id', targetGroupId)
      if (existingMembersError) {
        if (handleTableError(res, existingMembersError)) return
        json(res, 500, { error: existingMembersError.message })
        return
      }
      existingMembers = Array.isArray(rows) ? rows : []
    }

    if (
      !hasPatch &&
      membersToInsert.length === 0 &&
      !memberRoleAddress &&
      !removeMember
    ) {
      json(res, 400, { error: 'No updates provided' })
      return
    }

    if (membersToInsert.length > 0) {
      const existingSet = new Set(
        (Array.isArray(existingMembers) ? existingMembers : []).map((row) =>
          normalizeAddress(row.member_address),
        ),
      )
      const joinedAt = new Date().toISOString()
      const rows = membersToInsert
        .filter((memberAddress) => !existingSet.has(memberAddress))
        .map((memberAddress) => ({
          group_id: targetGroupId,
          member_address: memberAddress,
          role: 'member',
          joined_at: joinedAt,
        }))
      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('group_members').insert(rows)
        if (insertError) {
          if (handleTableError(res, insertError)) return
          json(res, 500, { error: insertError.message })
          return
        }
      }
      patch.updated_at = joinedAt
      hasPatch = true
    }

    if (memberRoleAddress && memberRole) {
      if (!canManageMembers) {
        json(res, 403, { error: 'Only group owner can manage member roles' })
        return
      }
      if (memberRole !== 'admin' && memberRole !== 'member') {
        json(res, 400, { error: 'Invalid member role' })
        return
      }
      const targetMember = existingMembers.find(
        (row) => normalizeAddress(row.member_address) === memberRoleAddress,
      )
      if (!targetMember) {
        json(res, 404, { error: 'Member not found' })
        return
      }
      const targetCurrentRole = String(targetMember.role ?? '').toLowerCase()
      if (targetCurrentRole === 'owner') {
        json(res, 400, { error: 'Owner role cannot be changed' })
        return
      }
      if (targetCurrentRole !== memberRole) {
        const { error: roleUpdateError } = await supabase
          .from('group_members')
          .update({ role: memberRole })
          .eq('group_id', targetGroupId)
          .eq('member_address', memberRoleAddress)
        if (roleUpdateError) {
          if (handleTableError(res, roleUpdateError)) return
          json(res, 500, { error: roleUpdateError.message })
          return
        }
      }
      patch.updated_at = new Date().toISOString()
      hasPatch = true
    }

    if (removeMember) {
      if (!canManageMembers) {
        json(res, 403, { error: 'Only group owner can remove members' })
        return
      }
      const targetMember = existingMembers.find(
        (row) => normalizeAddress(row.member_address) === removeMember,
      )
      if (!targetMember) {
        json(res, 404, { error: 'Member not found' })
        return
      }
      const targetCurrentRole = String(targetMember.role ?? '').toLowerCase()
      if (targetCurrentRole === 'owner') {
        json(res, 400, { error: 'Owner cannot be removed from the group' })
        return
      }
      const { error: removeMemberError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', targetGroupId)
        .eq('member_address', removeMember)
      if (removeMemberError) {
        if (handleTableError(res, removeMemberError)) return
        json(res, 500, { error: removeMemberError.message })
        return
      }
      patch.updated_at = new Date().toISOString()
      hasPatch = true
    }

    let updatedGroup = existingGroup
    if (hasPatch) {
      patch.updated_at = patch.updated_at ?? new Date().toISOString()
      const { data, error: updateError } = await supabase
        .from('groups')
        .update(patch)
        .eq('id', targetGroupId)
        .select('id, name, avatar_url, created_by, created_at, updated_at')
        .maybeSingle()
      if (updateError) {
        if (handleTableError(res, updateError)) return
        json(res, 500, { error: updateError.message })
        return
      }
      if (data) {
        updatedGroup = data
      }
    }
    if (!updatedGroup) {
      json(res, 404, { error: 'Group not found' })
      return
    }

    const { count: memberCount, error: countError } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', targetGroupId)
    if (countError) {
      if (handleTableError(res, countError)) return
      json(res, 500, { error: countError.message })
      return
    }

    json(res, 200, {
      data: {
        id: targetGroupId,
        name: mapGroupName(targetGroupId, updatedGroup.name),
        avatar_url:
          typeof updatedGroup.avatar_url === 'string'
            ? updatedGroup.avatar_url
            : null,
        created_by: normalizeAddress(updatedGroup.created_by ?? ''),
        created_at: updatedGroup.created_at ?? null,
        updated_at: updatedGroup.updated_at ?? updatedGroup.created_at ?? null,
        role: typeof membershipRow.role === 'string' ? membershipRow.role : 'member',
        member_count: memberCount ?? 0,
      },
    })
    return
  }

  if (req.method === 'DELETE') {
    const targetGroupId = normalizeGroupId(getQueryValue(req.query?.id))
    if (!targetGroupId) {
      json(res, 400, { error: 'Missing group id' })
      return
    }

    const [membershipResult, groupResult, membersResult] = await Promise.all([
      supabase
        .from('group_members')
        .select('role')
        .eq('group_id', targetGroupId)
        .eq('member_address', user)
        .maybeSingle(),
      supabase
        .from('groups')
        .select('id, created_by')
        .eq('id', targetGroupId)
        .maybeSingle(),
      supabase
        .from('group_members')
        .select('member_address, role, joined_at')
        .eq('group_id', targetGroupId)
        .order('joined_at', { ascending: true }),
    ])

    if (membershipResult.error) {
      if (handleTableError(res, membershipResult.error)) return
      json(res, 500, { error: membershipResult.error.message })
      return
    }
    if (groupResult.error) {
      if (handleTableError(res, groupResult.error)) return
      json(res, 500, { error: groupResult.error.message })
      return
    }
    if (membersResult.error) {
      if (handleTableError(res, membersResult.error)) return
      json(res, 500, { error: membersResult.error.message })
      return
    }

    if (!membershipResult.data || !groupResult.data) {
      json(res, 404, { error: 'Group not found' })
      return
    }

    const now = new Date().toISOString()
    const members = Array.isArray(membersResult.data) ? membersResult.data : []
    const otherMembers = members
      .map((member) => normalizeAddress(member.member_address))
      .filter((memberAddress) => memberAddress && memberAddress !== user)

    const { error: deleteMembershipError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', targetGroupId)
      .eq('member_address', user)
    if (deleteMembershipError) {
      if (handleTableError(res, deleteMembershipError)) return
      json(res, 500, { error: deleteMembershipError.message })
      return
    }

    if (otherMembers.length === 0) {
      const { error: deleteGroupError } = await supabase
        .from('groups')
        .delete()
        .eq('id', targetGroupId)
      if (deleteGroupError) {
        if (handleTableError(res, deleteGroupError)) return
        json(res, 500, { error: deleteGroupError.message })
        return
      }
      json(res, 200, { data: { id: targetGroupId, left: true, deleted: true } })
      return
    }

    const isOwner =
      normalizeAddress(groupResult.data.created_by) === user ||
      String(membershipResult.data.role ?? '').toLowerCase() === 'owner'

    if (isOwner) {
      const nextOwner = otherMembers[0]
      const { error: promoteOwnerError } = await supabase
        .from('group_members')
        .update({ role: 'owner' })
        .eq('group_id', targetGroupId)
        .eq('member_address', nextOwner)
      if (promoteOwnerError) {
        if (handleTableError(res, promoteOwnerError)) return
        json(res, 500, { error: promoteOwnerError.message })
        return
      }
      const { error: updateGroupError } = await supabase
        .from('groups')
        .update({ created_by: nextOwner, updated_at: now })
        .eq('id', targetGroupId)
      if (updateGroupError) {
        if (handleTableError(res, updateGroupError)) return
        json(res, 500, { error: updateGroupError.message })
        return
      }
    } else {
      const { error: touchGroupError } = await supabase
        .from('groups')
        .update({ updated_at: now })
        .eq('id', targetGroupId)
      if (touchGroupError) {
        if (handleTableError(res, touchGroupError)) return
        json(res, 500, { error: touchGroupError.message })
        return
      }
    }

    json(res, 200, {
      data: {
        id: targetGroupId,
        left: true,
        deleted: false,
      },
    })
    return
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const name = String(body.name ?? '').trim()
    if (!name) {
      json(res, 400, { error: 'Missing group name' })
      return
    }
    if (name.length > 64) {
      json(res, 400, { error: 'Group name is too long' })
      return
    }
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl)
    if (body.avatarUrl && !avatarUrl) {
      json(res, 400, { error: 'Invalid group avatar' })
      return
    }

    const members = normalizeAddressList(body.members)
    const allMembers = Array.from(new Set([user, ...members]))
    if (allMembers.length < 2) {
      json(res, 400, { error: 'Add at least one more member' })
      return
    }

    const groupId = `${GROUP_PREFIX}${crypto.randomUUID().replace(/-/g, '')}`
    const now = new Date().toISOString()
    const groupRow = {
      id: groupId,
      name,
      avatar_url: avatarUrl,
      created_by: user,
      created_at: now,
      updated_at: now,
    }
    const memberRows = allMembers.map((memberAddress) => ({
      group_id: groupId,
      member_address: memberAddress,
      role: memberAddress === user ? 'owner' : 'member',
      joined_at: now,
    }))

    const { error: groupError } = await supabase.from('groups').insert([groupRow])
    if (groupError) {
      if (handleTableError(res, groupError)) return
      json(res, 500, { error: groupError.message })
      return
    }

    const { error: membersError } = await supabase.from('group_members').insert(memberRows)
    if (membersError) {
      if (handleTableError(res, membersError)) return
      json(res, 500, { error: membersError.message })
      return
    }

    json(res, 200, {
      data: {
        ...groupRow,
        role: 'owner',
        member_count: allMembers.length,
      },
    })
    return
  }

  res.status(405).end()
}
