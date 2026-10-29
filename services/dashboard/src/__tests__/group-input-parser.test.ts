import { it, expect } from 'vitest';
import { groupIdentifier } from '@/lib/group-input';
it.each([
 ['telegram','@Good_name','@Good_name'],['telegram','https://t.me/Good_name','@Good_name'],
 ['vkontakte','vk_123','vk_123'],['vkontakte','club123','vk_123'],['vkontakte','https://vk.com/public123','vk_123'],
 ['facebook','https://www.facebook.com/groups/Abc-12/','https://www.facebook.com/groups/Abc-12/'],
])('accepts explicit %s representation %s',(platform,input,expected)=>expect(groupIdentifier(input,platform)).toBe(expected));
it.each([
 ['telegram','https://evil.example/@Good_name'],['telegram','https://evil.example/t.me/Good_name'],['telegram','https://t.me/Good_name/more'],['telegram','https://t.me/Good_name?x=1'],['telegram','@Good_name!'],['telegram',' @Good_name'],['telegram','@Good_name\r'],['telegram','http://127.0.0.1/t.me/Good_name'],
 ['vkontakte','123'],['vkontakte','vk_01'],['vkontakte','https://evil.example/vk.com/club123'],['vkontakte','https://vk.com/club123?x=1'],['vkontakte','vk_123/more'],
 ['facebook','http://www.facebook.com/groups/123'],['facebook','https://facebook.com.evil.example/groups/123'],['facebook','https://facebook.com:443/groups/123'],['facebook','https://facebook.com/groups/../123'],['facebook','https://facebook.com/groups/123?x=1'],['facebook','https://127.0.0.1/groups/123'],['facebook','https://facebook.com/groups/%31'],
])('rejects malformed %s input %s',(platform,input)=>expect(groupIdentifier(input,platform)).toBeNull());
