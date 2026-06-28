import {
  RiFileList3Line,
  RiShieldKeyholeLine,
  RiSparkling2Line,
} from 'react-icons/ri';

const authHighlights = [
  { Icon: RiFileList3Line, label: 'Bills' },
  { Icon: RiSparkling2Line, label: 'Insights' },
  { Icon: RiShieldKeyholeLine, label: 'Secure' },
];

export function AuthBrandPanel() {
  return (
    <div
      className="relative hidden bg-cover bg-center p-7 text-white lg:flex lg:flex-col lg:justify-between xl:p-8"
      style={{
        backgroundImage: 'linear-gradient(135deg, #4F9CF9, #34C759)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-black text-[#4F9CF9]">F</div>
        <div>
          <h1 className="text-xl font-black">Finovo AI</h1>
          <p className="text-sm text-white/85">Financial clarity, faster.</p>
        </div>
      </div>

      <div className="max-w-lg space-y-4">
        <p className="text-sm font-semibold uppercase text-white/85">Expense command center</p>
        <h2 className="text-4xl font-black leading-tight xl:text-[2.65rem]">Track spending, import bills, and ask AI what changed.</h2>
        <div className="grid grid-cols-3 gap-3 pt-2">
          {authHighlights.map(({ Icon, label }) => (
            <div key={label} className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
              <Icon className="text-lg text-white/85" aria-hidden="true" />
              <p className="mt-1.5 text-sm font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
