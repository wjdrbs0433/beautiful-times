import test from 'node:test';
import assert from 'node:assert/strict';
import {kakaoProfile} from '../src/auth/profile.ts';

test('현재 카카오 연결의 이름·사진을 우선하고 다른 제공자 정보와 섞지 않는다',()=>{
 const user={user_metadata:{full_name:'앱 별명'},identities:[{provider:'google',identity_data:{name:'다른 계정'}},{provider:'kakao',identity_data:{name:'카카오 이름',avatar_url:'http://k.kakaocdn.net/photo.jpg'}}]};
 assert.deepEqual(kakaoProfile(user),{name:'카카오 이름',avatarUrl:'https://k.kakaocdn.net/photo.jpg'});
});
test('선택 동의 거절·잘못된 메타데이터에서도 계정 영역을 표시한다',()=>{
 for(const user of [{},{user_metadata:null},{user_metadata:{name:42,avatar_url:[]}}])assert.deepEqual(kakaoProfile(user),{name:'이름을 제공하지 않은 계정',avatarUrl:''});
 assert.equal(kakaoProfile({user_metadata:{full_name:'  프로필 이름  '}}).name,'프로필 이름');
});
test('사진은 HTTPS 주소만 사용하고 제공되지 않으면 기본 프로필로 대체한다',()=>{
 for(const url of ['javascript:alert(1)','file:///private/photo.jpg','http://example.com/photo.jpg','https://user:pass@example.com/photo.jpg'])assert.equal(kakaoProfile({user_metadata:{avatar_url:url}}).avatarUrl,'');
 assert.equal(kakaoProfile({user_metadata:{avatar_url:'https://k.kakaocdn.net/photo.jpg'}}).avatarUrl,'https://k.kakaocdn.net/photo.jpg');
});
