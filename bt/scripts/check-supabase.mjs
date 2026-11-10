import { checkCloudConnection } from '../src/cloudConnection.ts';
try {
  const result = await checkCloudConnection();
  console.log(JSON.stringify({ database: result.database, auth: result.auth, kakaoEnabled: result.kakaoEnabled, probeTableMissing: result.schemaProtected, checkedAt: result.checkedAt },null,2));
} catch (error) { console.error(error.message); process.exitCode=1; }
