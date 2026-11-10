import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { kakaoProfile } from '../auth/profile';

export default function AccountProfile({user}:{user:User}) {
  const profile=kakaoProfile(user);
  const [failedUrl,setFailedUrl]=useState('');
  return <View style={styles.card}>
    {profile.avatarUrl&&failedUrl!==profile.avatarUrl
      ? <Image source={{uri:profile.avatarUrl}} style={styles.avatar} accessibilityLabel="카카오 프로필 사진" onError={()=>setFailedUrl(profile.avatarUrl)} />
      : <View style={[styles.avatar,styles.placeholder]} accessibilityLabel="기본 프로필 사진"><Ionicons name="person-outline" size={28} color="#687862"/></View>}
    <View style={styles.details}>
      <Text style={styles.label}>카카오 계정</Text>
      <Text style={styles.name}>{profile.name}</Text>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  card:{flexDirection:'row',alignItems:'center',gap:14,padding:16,marginBottom:12,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E4E7E0',borderRadius:10},
  avatar:{width:56,height:56,borderRadius:28},
  placeholder:{backgroundColor:'#EEF1EA',alignItems:'center',justifyContent:'center'},
  details:{flex:1,gap:4},
  label:{fontSize:12,color:'#777D77'},
  name:{fontSize:18,fontWeight:'600',lineHeight:26,color:'#333833'},
});
