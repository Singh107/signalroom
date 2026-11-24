import { Outlet } from 'react-router-dom'
import { RecordScope, useAuth } from 'deepspace'
import { APP_ID } from '../../../../constants'
import { schemas } from '../../../../schemas'
import { demoRoomId } from '../../../../lib/workspace-access'
import { DemoContext } from '../../../../components/workspace-context'

export default function DemoLayout() {
  const { userId } = useAuth()
  if (!userId) return null
  return <RecordScope key={userId} roomId={demoRoomId(APP_ID, userId)} schemas={schemas}>
    <DemoContext.Provider value={true}>
      <p className="border-b border-teal-900 bg-teal-950/40 px-4 py-3 text-center text-sm text-teal-200">Personal demo workspace · Use synthetic data only. Open this demo in two tabs to try realtime updates.</p>
      <Outlet />
    </DemoContext.Provider>
  </RecordScope>
}
