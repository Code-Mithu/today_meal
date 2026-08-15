import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * ShareManager — wraps expo-sharing for native share sheet functionality.
 */
export async function shareFile(uri: string, mimeType: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}

export async function shareText(text: string, title: string): Promise<void> {
  const fileName = `${title.replace(/\s+/g, '_')}.txt`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, text);
  await shareFile(fileUri, 'text/plain', title);
}

export async function shareJoinCode(joinCode: string, groupName: string): Promise<void> {
  const text = `Join "${groupName}" on Today Meal!\n\nUse this join code: ${joinCode}`;
  await shareText(text, 'Share Join Code');
}
