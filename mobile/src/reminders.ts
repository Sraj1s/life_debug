import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const channelId = 'commitments';

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function localDay(date = new Date(), offset = 0): string {
  const day = new Date(date);
  day.setDate(day.getDate() + offset);
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
}

export async function scheduleReminder(owner: string, id: number, date: Date, body: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Reminders require the mobile app.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'Commitment reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    throw new Error('Allow Life Debug notifications in your phone settings.');
  }
  if (date.getTime() <= Date.now()) throw new Error('Choose a future time for the reminder.');
  await Notifications.scheduleNotificationAsync({
    identifier: 'life-debug-' + owner + '-' + id,
    content: { title: 'Life Debug reminder', body, data: { owner, commitmentId: id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
  });
}

export async function cancelReminders(owner: string, activeIds: number[] = []) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter(({content}) =>
    content.data?.owner === owner && !activeIds.includes(Number(content.data.commitmentId))
  ).map(({identifier}) => Notifications.cancelScheduledNotificationAsync(identifier)));
}

export async function cancelCommitmentReminder(owner: string, id: number) {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await Notifications.cancelScheduledNotificationAsync('life-debug-' + owner + '-' + id);
  }
}
