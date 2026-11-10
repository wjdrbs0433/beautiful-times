// Abort stalled cloud requests so local records remain usable while offline.
export const cloudFetch: typeof fetch = async (input, options) => {
 const controller=new AbortController();
 const incoming=options?.signal;
 const abort=()=>controller.abort();
 if(incoming?.aborted)abort();else incoming?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,45000);
 try{return await fetch(input,{...options,signal:controller.signal});}
 finally{clearTimeout(timer);incoming?.removeEventListener('abort',abort);}
};
