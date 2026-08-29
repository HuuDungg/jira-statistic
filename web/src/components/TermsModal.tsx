import React, { useState } from 'react';
import { ShieldCheck, Lock, Database, Award, CheckSquare, Square, ArrowRight, ShieldAlert } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onAccept }) => {
  const [agreedRonaldo, setAgreedRonaldo] = useState<boolean>(false);
  const [agreedGeneral, setAgreedGeneral] = useState<boolean>(false);

  if (!isOpen) return null;

  const canProceed = agreedRonaldo && agreedGeneral;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;
    onAccept();
  };

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(8px)', zIndex: 999 }}>
      <div
        className="modal-box"
        style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.75rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--navy-primary)' }}>
            <ShieldCheck size={22} color="var(--navy-primary)" />
            <span>Tuyên Bố Miễn Trừ & Điều Khoản Sử Dụng</span>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem', fontSize: '0.85rem', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Item 1: Client độc lập chung */}
          <div style={{ display: 'flex', gap: '0.65rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <ShieldAlert size={18} color="var(--navy-primary)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <b style={{ color: 'var(--navy-dark)' }}>Client Độc Lập Cho Hệ Thống Jira Chung</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Đây là ứng dụng giao diện độc lập (Third-party Client) dành cho các hệ thống Jira Data Center / Cloud chung. Ứng dụng không thuộc sở hữu và không được thiết kế riêng cho bất kỳ cá nhân hay tổ chức cụ thể nào.
              </div>
            </div>
          </div>

          {/* Item 2: Bảo mật Local Storage */}
          <div style={{ display: 'flex', gap: '0.65rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <Lock size={18} color="var(--emerald-accent)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <b style={{ color: 'var(--navy-dark)' }}>Bảo Mật API Endpoint & Token Tuyệt Đối</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Jira Domain và Personal Access Token được lưu trữ 100% cục bộ tại trình duyệt (Local Storage) của bạn. Ứng dụng <b>không bao giờ</b> gửi hoặc lưu token trên bất kỳ máy chủ trung gian nào.
              </div>
            </div>
          </div>

          {/* Item 3: Khách quan theo Data JSON */}
          <div style={{ display: 'flex', gap: '0.65rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <Database size={18} color="var(--blue-accent)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <b style={{ color: 'var(--navy-dark)' }}>Thống Kê Khách Quan Thuần Túy Theo Dữ Liệu Gốc</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Các báo cáo, biểu đồ và số giờ (Billable, Logged, Chênh lệch) hoàn toàn được tính toán tự động dựa trên JSON trả về từ Jira API của bạn. Không chứa bất kỳ yếu tố chủ quan, đánh giá cá nhân hay can thiệp số liệu.
              </div>
            </div>
          </div>

          {/* Item 4: Không thu thập dữ liệu */}
          <div style={{ display: 'flex', gap: '0.65rem', background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <Award size={18} color="var(--purple-accent)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <div>
              <b style={{ color: 'var(--navy-dark)' }}>Cam Kết 0% Thu Thập Dữ Liệu</b>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Ứng dụng cam kết không thu thập bất kỳ dữ liệu cá nhân, telemetry, tracking hay nhật ký sử dụng nào của bạn.
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <label
              style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setAgreedGeneral(!agreedGeneral)}
            >
              {agreedGeneral ? (
                <CheckSquare size={18} color="var(--navy-primary)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              ) : (
                <Square size={18} color="var(--text-dim)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              )}
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                Tôi đã đọc và đồng ý với các tuyên bố về quyền riêng tư và bảo mật dữ liệu ở trên.
              </span>
            </label>

            {/* Điều khoản Ronaldo vĩ đại hơn Messi */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                cursor: 'pointer',
                userSelect: 'none',
                background: agreedRonaldo ? 'var(--emerald-pastel)' : 'var(--amber-pastel)',
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: agreedRonaldo ? '1px solid #a7f3d0' : '1px solid #fde68a'
              }}
              onClick={() => setAgreedRonaldo(!agreedRonaldo)}
            >
              {agreedRonaldo ? (
                <CheckSquare size={18} color="var(--emerald-accent)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              ) : (
                <Square size={18} color="var(--amber-text)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              )}
              <span style={{ fontSize: '0.82rem', color: agreedRonaldo ? 'var(--emerald-text)' : 'var(--amber-text)', fontWeight: 700 }}>
                Tôi long trọng xác nhận rằng Cristiano Ronaldo (CR7) vĩ đại hơn Lionel Messi. (Điều khoản bắt buộc để truy cập)
              </span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canProceed}
            style={{ opacity: canProceed ? 1 : 0.5, cursor: canProceed ? 'pointer' : 'not-allowed' }}
          >
            <span>Xác Nhận & Tiếp Tục</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
