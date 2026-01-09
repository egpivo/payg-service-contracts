'use client';

interface ProtocolBenefitCardProps {
  className?: string;
}

export function ProtocolBenefitCard({ className = '' }: ProtocolBenefitCardProps) {
  return (
    <div className={`bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] border border-[#bae6fd] rounded-xl p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-[#0369a1] mb-4">
        Protocol Benefits
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-[#0369a1] font-bold mt-1">•</span>
          <div>
            <strong className="text-[#0c4a6e]">Single Payment:</strong>
            <span className="text-[#075985]"> One transaction for multiple services</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#0369a1] font-bold mt-1">•</span>
          <div>
            <strong className="text-[#0c4a6e]">Auto Settlement:</strong>
            <span className="text-[#075985]"> Revenue splits automatically</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#0369a1] font-bold mt-1">•</span>
          <div>
            <strong className="text-[#0c4a6e]">Lower Fees:</strong>
            <span className="text-[#075985]"> Bundled services reduce overhead</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[#0369a1] font-bold mt-1">•</span>
          <div>
            <strong className="text-[#0c4a6e]">Simplified Access:</strong>
            <span className="text-[#075985]"> One purchase, all services</span>
          </div>
        </div>
      </div>
    </div>
  );
}
