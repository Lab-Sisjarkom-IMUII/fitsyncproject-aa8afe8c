import React from 'react';

interface Props {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const InsightCard: React.FC<Props> = ({
  children,
  title,
  subtitle,
  className = '',
  icon
}) => {
  return (
    <div className={`bg-[#161B22] border border-[#30363D] rounded-2xl shadow-md transition-all duration-200 ${className}`}>
      {(title || subtitle) && (
        <div className="p-4 border-b border-[#30363D]">
          <div className="flex items-center gap-2">
            {icon && <div className="text-[#00FFAA]">{icon}</div>}
            <div>
              <h3 className="text-white font-medium">{title}</h3>
              {subtitle && <p className="text-[#8B949E] text-sm">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default InsightCard;