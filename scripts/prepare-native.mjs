import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const platform=process.argv[2];
if(!['android','ios'].includes(platform)) throw Error('Use android ou ios');
function run(args) { const r=spawnSync('npx',['cap',...args],{stdio:'inherit'}); if(r.status!==0) process.exit(r.status??1); }
if(!existsSync(platform)) run(['add',platform]);
if(platform==='android') {
 const path='android/app/src/main/AndroidManifest.xml'; let s=readFileSync(path,'utf8');
 const allowed=['READ_HEART_RATE','READ_OXYGEN_SATURATION','READ_STEPS','READ_ACTIVE_CALORIES_BURNED','READ_SLEEP'];
 if(!s.includes('xmlns:tools=')) s=s.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
 const library=readFileSync('node_modules/@capgo/capacitor-health/android/src/main/AndroidManifest.xml','utf8');
 for(const match of library.matchAll(/android:name="(android.permission.health.([^"]+))"/g)) {
  if(!allowed.includes(match[2])&&!s.includes(`android:name="${match[1]}"`)) s=s.replace('</manifest>', `<uses-permission android:name="${match[1]}" tools:node="remove" />\n</manifest>`);
 }
 for(const name of allowed) {
  const permission=`android.permission.health.${name}`;
  if(!s.includes(`android:name="${permission}"`)) s=s.replace('</manifest>',`    <uses-permission android:name="${permission}" />\n</manifest>`);
 }
 if(!s.includes('com.google.android.apps.healthdata')) s=s.replace('</manifest>','<queries><package android:name="com.google.android.apps.healthdata" /></queries>\n</manifest>');
 writeFileSync(path,s);
 const strings='android/app/src/main/res/values/strings.xml';s=readFileSync(strings,'utf8');
 if(!s.includes('health_connect_privacy_policy_url')) s=s.replace('</resources>','<string name="health_connect_privacy_policy_url">https://encorpei-saude-ultimaversao.vercel.app/privacidade</string>\n</resources>');
 writeFileSync(strings,s);
} else {
 const path='ios/App/App/Info.plist';let s=readFileSync(path,'utf8');
 s=s.replace(/<key>NSHealthShareUsageDescription<\/key>\s*<string>[^<]*<\/string>/g,'');
 const index=s.lastIndexOf('</dict>');
 if(index<0) throw Error('Info.plist inválido');
 s=s.slice(0,index)+'<key>NSHealthShareUsageDescription</key><string>Com sua autorização, lemos batimentos, oxigenação, passos, calorias e sono para compartilhar com seu médico vinculado.</string>\n'+s.slice(index);
 writeFileSync(path,s);
 writeFileSync('ios/App/App/App.entitlements','<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.developer.healthkit</key><true/></dict></plist>');
 const project='ios/App/App.xcodeproj/project.pbxproj';s=readFileSync(project,'utf8');
 if(!s.includes('CODE_SIGN_ENTITLEMENTS')) s=s.replaceAll('INFOPLIST_FILE = App/Info.plist;','INFOPLIST_FILE = App/Info.plist;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;');
 writeFileSync(project,s);
}
run(['sync',platform]);
