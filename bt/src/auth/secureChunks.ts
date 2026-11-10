type Vault = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
type Manifest = { generation: string; count: number };
// Keep every encrypted Keychain value below historical iOS payload limits.
export function secureChunks(vault: Vault, generation: () => string) {
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await vault.getItemAsync(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!/^[a-zA-Z0-9-]+$/.test(data.generation) || !Number.isInteger(data.count) || data.count < 1 || data.count > 256) throw new Error('로그인 보관 정보를 확인하지 못했어요.');
    return data;
  }
  async function clean(key: string, previous: Manifest | null) {
    if (previous) await Promise.all(Array.from({length:previous.count},(_,i)=>vault.deleteItemAsync(`${key}.${previous.generation}.${i}`)));
  }
  return {
    async getItem(key: string) {
      const meta = await manifest(key); if (!meta) return null;
      const values = await Promise.all(Array.from({length:meta.count},(_,i)=>vault.getItemAsync(`${key}.${meta.generation}.${i}`)));
      if (values.some(value=>value === null)) throw new Error('로그인 보관 정보가 불완전해요.');
      return values.join('');
    },
    async setItem(key: string, value: string) {
      const previous = await manifest(key);
      const next = {generation:generation(),count:Math.max(1,Math.ceil(value.length/512))};
      if(next.count>256)throw new Error('로그인 정보가 너무 커요.');
      try {
        for(let i=0;i<next.count;i++)await vault.setItemAsync(`${key}.${next.generation}.${i}`,value.slice(i*512,(i+1)*512));
        await vault.setItemAsync(key,JSON.stringify(next));
      } catch(error) { await clean(key,next).catch(()=>{});throw error; }
      await clean(key,previous).catch(()=>{});
    },
    async removeItem(key:string) { const previous = await manifest(key); await vault.deleteItemAsync(key);await clean(key,previous).catch(()=>{}); },
  };
}
