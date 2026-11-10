import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Linking,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import type {User} from '@supabase/supabase-js';
import {checkCloudConnection} from '../cloudConnection';
import {getAuthClient} from './client';
import {openLogin} from './platform';
import {kakaoLoginOptions} from './kakao';
import {parseAuthCallback} from './callback';
export function AuthGate({children}:{children:(user:User,logout:()=>Promise<void>,testIdle:()=>Promise<void>)=>React.ReactNode}) {
 const [user,setUser]=useState<User|null>(null);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const restore = useCallback(async () => {
  const {client,activity}=await getAuthClient();
  const result=await client.auth.getSession();
  if(result.error)throw result.error;
  const session=result.data.session;
  const expired=activity.takeExpired();
  if(session)await activity.markActive();
  setUser(session?.user??null);
  if(expired&&!session)setError('30일 동안 앱을 사용하지 않아 로그인 상태가 해제됐어요. 카카오로 다시 로그인해 주세요.');
 },[]);
 useEffect(()=>{
  let active=true;let unsubscribe:(()=>void)|undefined;let appState:{remove:()=>void}|undefined;
  let heartbeat:ReturnType<typeof setInterval>|undefined;let webCleanup:(()=>void)|undefined;
  let queue=Promise.resolve();
  const foreground=()=>Platform.OS==='web'?document.visibilityState==='visible':AppState.currentState==='active';
  function verify(){
   queue=queue.then(async()=>{if(active)await restore();}).catch(()=>{if(active)setError('로그인 상태를 확인하지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요.');});
   return queue;
  }
  async function initialize(){
   try{
    const {client,activity}=await getAuthClient();if(!active)return;
    const {data}=client.auth.onAuthStateChange((_event,session)=>{if(active)setUser(session?.user??null);});
    unsubscribe=()=>data.subscription.unsubscribe();
    if(Platform.OS!=='web') {
     const initial=await Linking.getInitialURL();
     // A consumed cold-start callback must not prevent restoring a saved session.
     const existing=await client.auth.getSession();
     if(!existing.data.session&&initial?.startsWith('bt://auth/callback')) {
      const callback=parseAuthCallback(initial,'bt://auth/callback');
      const exchanged=await client.auth.exchangeCodeForSession(callback.code,callback.flowId?{flowId:callback.flowId}:undefined);
      if(exchanged.error)throw exchanged.error;
     }
     const update=(state:string)=>{
      if(state==='active')void verify().then(()=>{if(active&&foreground())client.auth.startAutoRefresh();});
      else { client.auth.stopAutoRefresh();void activity.markActive().catch(()=>{}); }
     };
     appState=AppState.addEventListener('change',update);
     if(foreground())client.auth.startAutoRefresh();else client.auth.stopAutoRefresh();
    }else{
     const visibility=()=>{if(foreground())void verify();};
     document.addEventListener('visibilitychange',visibility);
     window.addEventListener('focus',visibility);
     webCleanup=()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',visibility);};
    }
    await restore();
    heartbeat=setInterval(()=>{if(active&&foreground())void activity.markActive().catch(()=>{});},60000);
   }catch{if(active)setError('로그인 연결을 준비하지 못했어요. 인터넷 연결을 확인한 뒤 앱을 다시 실행해 주세요.');}
   finally{if(active)setReady(true);}
  }
  void initialize();return()=>{active=false;unsubscribe?.();appState?.remove();webCleanup?.();clearInterval(heartbeat);if(Platform.OS!=='web')void getAuthClient().then(({client})=>client.auth.stopAutoRefresh());};
 },[restore]);
 async function testIdle(){
  if(!__DEV__)return;
  const {activity}=await getAuthClient();
  await activity.simulate31DaysInactive();
  await restore();
 }
 async function login(){
  if(busy)return;setBusy(true);setError('');
  try{
   const connection=await checkCloudConnection();
   if(!connection.kakaoEnabled)throw new Error('카카오 로그인 서버 연결이 아직 준비 중이에요. 연결 설정이 끝나면 이 버튼으로 가입과 로그인을 할 수 있어요.');
   const {client,redirectTo}=await getAuthClient();
   const result=await client.auth.signInWithOAuth(kakaoLoginOptions(redirectTo));
   if(result.error)throw new Error('카카오 로그인 요청을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
   if(!result.data.url)throw new Error('로그인 주소를 받지 못했어요.');
   const returned=await openLogin(result.data.url,redirectTo);
   if(returned){const {code,flowId}=parseAuthCallback(returned,redirectTo);const exchange=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);if(exchange.error)throw new Error('로그인을 완료하지 못했어요. 다시 시도해 주세요.');}
  }catch(error){setError(error instanceof Error?error.message:'카카오 로그인을 완료하지 못했어요.');}
  finally{setBusy(false);}
 }
 async function logout(){const {client}=await getAuthClient();const result=await client.auth.signOut({scope:'local'});if(result.error)throw new Error('로그아웃을 완료하지 못했어요.');}
 if(!ready)return <SafeAreaView style={s.root}><View style={s.loading}><ActivityIndicator color="#687862"/><Text style={s.caption}>로그인 상태를 확인하고 있어요.</Text></View></SafeAreaView>;
 if(user)return <>{children(user,logout,testIdle)}</>;
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content}>
  <View style={s.brand}><Text style={s.mark}>BT</Text><Text style={s.brandText}>BEAUTIFUL TIMES</Text></View>
  <View style={s.art}><Ionicons name="heart-outline" size={58} color="#687862"/><Text style={s.artCaption}>Our beautiful times, together.</Text></View>
  <Text style={s.title}>소중한 우리들의 시간</Text>
  <Text style={s.body}>둘만의 하루부터 가족의 여행까지.{"\n"}함께한 순간을 차곡차곡 담아 보세요.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={login} style={[s.kakao,busy&&{opacity:.6}]}><Ionicons name="chatbubble" size={20} color="#191919"/><Text style={s.kakaoText}>{busy?'로그인 연결 중…':'카카오로 시작하기'}</Text></Pressable>
  <Text style={s.caption}>처음 로그인하면 BT 계정이 만들어집니다.{"\n"}이미 가입했다면 같은 카카오 계정으로 로그인하세요.</Text>
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#FAFBF8'},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:16},content:{flexGrow:1,width:'100%',maxWidth:460,alignSelf:'center',justifyContent:'center',padding:28,paddingVertical:50},brand:{alignItems:'center',gap:8},mark:{fontSize:44,fontWeight:'700',letterSpacing:-3,color:'#333833'},brandText:{fontSize:10,letterSpacing:3,color:'#777D77'},art:{height:210,alignItems:'center',justifyContent:'center',gap:20},artCaption:{fontSize:12,color:'#687862'},title:{fontSize:26,fontWeight:'600',color:'#333833',textAlign:'center'},body:{fontSize:15,lineHeight:26,color:'#777D77',textAlign:'center',marginTop:18,marginBottom:42},kakao:{minHeight:56,backgroundColor:'#FEE500',borderRadius:8,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10},kakaoText:{fontSize:16,fontWeight:'600',color:'#191919'},caption:{fontSize:12,lineHeight:20,color:'#777D77',textAlign:'center',marginTop:20},error:{color:'#995A4C',fontSize:13,lineHeight:22,marginTop:22,textAlign:'center'}});
