'use client';

import LiveKitSession from '@/components/LiveKitSession';

export default function Page() {
  const roomName = 'quickstart-room';
  const userName = 'quickstart-user';

  return (
    <div className="page-wrapper">
      <LiveKitSession roomName={roomName} userName={userName} />
    </div>
  );
}