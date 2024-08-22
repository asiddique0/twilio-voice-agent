import { db } from "../firebase/firebase";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { AssistantConfigRequest } from "../common/types";
import { noticeMetadata, writeLog } from "../utility/logger";

const ASSISTANT_CONFIG = "assistant_config";

export async function getAssistantConfig(assistantConfigId: string) {
  const docRef = doc(db, ASSISTANT_CONFIG, assistantConfigId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as AssistantConfigRequest;
  } else {
    writeLog(noticeMetadata, {
      message: `No session config found for ${assistantConfigId}`,
    });
    return null;
  }
}

export async function getAllAssistantConfigs() {
  const q = query(collection(db, ASSISTANT_CONFIG), orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty
    ? []
    : querySnapshot.docs.map((doc) => doc.data() as AssistantConfigRequest);
}

export async function createAssistantConfig(config: AssistantConfigRequest) {
  const docRef = doc(db, ASSISTANT_CONFIG, config.id);
  await setDoc(docRef, config, { merge: true });
}
