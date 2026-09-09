# VK API Reference — Key Methods for Lead Generation

**API Version:** 5.199
**Base URL:** `https://api.vk.com/method/`
**Auth:** `?access_token=TOKEN&v=5.199`

---

## Token Types
- **User token** — obtained via Implicit Flow (OAuth popup)
- **Group token** — obtained in community Settings > API usage > Access tokens
- **Service token** — obtained from standalone app settings (read-only)

---

## Messages API (Outreach)

### messages.send
**Access:** user, group
**Purpose:** Send a message to a user or community conversation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `peer_id` | int64 | yes | Destination ID. User: `12345`, Chat: `2000000001`, Community: `-12345` |
| `message` | string | if no attachment | Message text (max 9000 chars) |
| `attachment` | string | if no message | Media: `photo100_12345`, `doc123_456` |
| `group_id` | int64 | no | For group messages with user token |
| `random_id` | int | yes | Unique ID to prevent duplicates |
| `dont_parse_links` | bool | no | Don't generate link previews |
| `keyboard` | string | no | JSON keyboard object |
| `template` | string | no | JSON template object |

**Errors:**
- `900` — Can't send messages to this user (privacy settings)
- `901` — Can't send messages to communities
- `902` — Can't send messages to this user (not allowed by privacy)
- `913` — Too many messages
- `914` — Message too long
- `921` — Flood control (too many messages per second)

### messages.getConversations
**Access:** user, group
**Purpose:** List conversations (dialogs).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | int | 0 | Pagination offset |
| `count` | int | 20 | Max 200 |
| `filter` | string | "all" | `all`, `unread`, `important`, `unanswered` |
| `extended` | bool | false | Return user/group objects |
| `group_id` | int64 | no | For group messages with user token |

### messages.getConversationMembers
**Access:** user, group
**Purpose:** Get members of a chat/conversation.

### messages.getHistory
**Access:** user, group
**Purpose:** Get message history for a conversation.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `peer_id` | int64 | yes | Conversation ID |
| `offset` | int | 0 | Pagination |
| `count` | int | 20 | Max 200 |
| `start_message_id` | int | no | Start from this message |
| `rev` | int | 0 | 0=reverse, 1=chronological |

### messages.getLongPollServer
**Access:** user, group
**Purpose:** Get Long Poll server data for real-time message updates.

### messages.getLongPollHistory
**Access:** user, group
**Purpose:** Get updates from Long Poll server.

### messages.allowMessagesFromGroup
**Access:** user
**Purpose:** Allow a community to send messages to current user.

### messages.isMessagesFromGroupAllowed
**Access:** user, group
**Purpose:** Check if community can send messages to a user.

### messages.markAsReadConversation
**Access:** user, group
**Purpose:** Mark conversation as read.

---

## Wall API (Posting & Comments)

### wall.post
**Access:** user
**Purpose:** Create a post on a wall.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner_id` | int64 | yes | User or community ID (negative for community) |
| `from_group` | bool | no | Post as community (requires admin) |
| `message` | string | if no attachments | Post text |
| `attachments` | string[] | if no message | Media attachments |
| `publish_date` | int | no | Unix timestamp for scheduled posts |
| `close_comments` | bool | no | Disable comments |
| `mark_as_ads` | bool | no | Mark as advertisement |

**Returns:** `{ "post_id": 123 }`

### wall.get
**Access:** user, service
**Purpose:** Get wall posts.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `owner_id` | int64 | current | Wall owner (negative for community) |
| `offset` | int | 0 | Pagination |
| `count` | int | 20 | Max 100 |
| `filter` | string | "all" | `owner`, `others`, `suggests`, `postponed` |
| `extended` | bool | false | Return profiles/groups |

### wall.getComments
**Access:** user, service
**Purpose:** Get comments on a post.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `owner_id` | int64 | yes | Post owner |
| `post_id` | int | yes | Post ID |
| `offset` | int | 0 | Pagination |
| `count` | int | 20 | Max 100 |
| `sort` | string | "asc" | `asc`, `desc`, `smart` |
| `preview_length` | int | 90 | Truncate comments at N chars |
| `extended` | bool | false | Return profiles/groups |
| `thread_items_count` | int | 0 | Max 10 — items in comment threads |

### wall.createComment
**Access:** user, group
**Purpose:** Add a comment to a post.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `owner_id` | int64 | yes | Post owner |
| `post_id` | int | yes | Post ID |
| `message` | string | if no attachment | Comment text |
| `attachments` | string[] | if no message | Media |
| `reply_to_comment` | int | no | Reply to specific comment |
| `from_group` | int64 | no | Comment as community |

### wall.getById
**Access:** user, service
**Purpose:** Get specific posts by IDs.

### wall.search
**Access:** user, service
**Purpose:** Search posts on a wall.

### wall.delete / wall.edit / wall.pin / wall.unpin / wall.repost
Various wall management operations.

---

## Groups API (Community Management)

### groups.getById
**Access:** user, group, service
**Purpose:** Get community info by ID.

| Parameter | Type | Description |
|-----------|------|-------------|
| `group_id` | int64/string | Community ID or screen name |
| `group_ids` | int64[]/string[] | Multiple IDs (max 100) |
| `fields` | string[] | Additional fields to return |

**Returns:** Community objects with name, members_count, status, etc.

### groups.getMembers
**Access:** user, group, service
**Purpose:** Get list of community members.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `group_id` | int64/string | yes | Community ID or screen name |
| `sort` | string | "id_asc" | `id_asc`, `id_desc`, `time_asc`, `time_desc` |
| `offset` | int | 0 | Pagination |
| `count` | int | 1000 | Max 1000 |
| `fields` | string[] | no | User fields to return |
| `filter` | string | no | `friends`, `unsure`, `managers`, `donut` |

### groups.search
**Access:** user, service
**Purpose:** Search communities by query.

### groups.getLongPollServer
**Access:** user, group
**Purpose:** Get Long Poll server for group events (new messages, wall posts, etc.)

### groups.getCallbackSettings / groups.setCallbackSettings
**Access:** user, group
**Purpose:** Manage Callback API notification settings.

### groups.getTokenPermissions
**Access:** group
**Purpose:** Check what permissions the group token has.

### groups.getInvitedUsers
**Access:** user
**Purpose:** Get list of invited (but not yet joined) users.

### groups.isMember
**Access:** user, group, service
**Purpose:** Check if a user is a member of a community.

---

## Users API

### users.get
**Access:** user, service
**Purpose:** Get user profile information.

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_ids` | string[] | User IDs or screen names (max 1000) |
| `fields` | string[] | Profile fields to return |
| `name_case` | string | Declension case |

**Available fields:** `nickname`, `screen_name`, `sex`, `bdate`, `city`, `country`, `timezone`, `photo`, `photo_medium`, `photo_big`, `has_mobile`, `contacts`, `education`, `online`, `counters`, `relation`, `last_seen`, `activity`, `can_write_private_message`, `can_see_all_posts`, `can_post`, `universities`

---

## Newsfeed API

### newsfeed.get
**Access:** user (requires `wall` + `friends` permissions — exceptional)
**Purpose:** Get news feed items.

**⚠️ IMPORTANT:** As of August 27, 2025:
- `newsfeed.getComments` — DELETED
- `newsfeed.getRecommended` — DELETED
- `newsfeed.saveList` — DELETED
- Filter `friend` and source `list` — DISABLED

---

## Key Error Codes

| Code | Description |
|------|-------------|
| 5 | Authorization failed |
| 6 | Too many requests per second |
| 7 | Permission denied |
| 14 | CAPTCHA needed |
| 15 | Access denied |
| 17 | Validation required |
| 100 | Invalid parameter |
| 101 | Invalid app ID |
| 113 | Invalid user ID |
| 150 | Invalid hash |
| 214 | Messages from group are not allowed |
| 220 | Flood control |
| 300 | Group wall is disabled |
| 900 | Can't send messages |
| 901 | Can't send messages to communities |
| 913 | Too many messages |
| 914 | Message too long |
| 921 | Flood control |

---

## Rate Limits

**Per user token:**
- 3 requests/second (global)
- 20 requests/second (specific methods)

**Per group token:**
- 20 requests/second

**messages.send:**
- ~30 messages/minute per user
- VK actively detects mass messaging patterns

---

## Anti-Ban Best Practices

1. **Random delays:** 15-45 seconds between actions
2. **Daily limits:** Start with 5-10 actions/day, increase over 3-7 days
3. **Warmup stages:**
   - Day 1: 5 actions
   - Day 2: 15 actions
   - Day 3: 30 actions
   - Day 4+: full limits
4. **Avoid patterns:** Randomize message order, timing, recipients
5. **Use multiple accounts:** Spread load across accounts
6. **Proxy rotation:** Different IP per account
7. **Respect flood wait:** When VK returns error 921, sleep for the required time
8. **Don't reuse content:** Use spintax for text variation
9. **Monitor bans:** If an account is banned, rotate it out for 24+ hours

---

## Long Poll (Real-time Events)

### For Communities:
```
1. Call groups.getLongPollServer → get server, key, ts
2. Connect to: {server}?act=a_check&key={key}&ts={ts}&wait=25
3. Parse events array from response
4. Update ts from response for next poll
```

**Event types:**
- `4` — New message (code 4)
- `5` — New wall post
- `6` — New wall reply (comment)
- `7` — New comment on post
- `8` — New friend request
- `9` — Leave from community
- `10` — Subscribers added

### For Users:
```
1. Call messages.getLongPollServer → get server, key, ts, pts
2. Connect to: {server}?act=a_check&key={key}&ts={ts}&pts={pts}&wait=25
3. Parse updates
```

---

## Photo Upload (for attachments)

```
1. Call photos.getWallUploadServer → get upload_url
2. POST photo to upload_url → get server, photo, hash
3. Call photos.saveWallPhoto with server, photo, hash → get photo object
4. Use photo_id in attachments: "photo{owner_id}_{photo_id}"
```

---

## Document Upload (for attachments)

```
1. Call docs.getWallUploadServer → get upload_url
2. POST file to upload_url → get file
3. Call docs.save with file → get doc object
4. Use doc_id in attachments: "doc{owner_id}_{doc_id}"
```
