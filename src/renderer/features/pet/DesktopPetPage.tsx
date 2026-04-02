import { useEffect, useState } from 'react';
import mascotImage from '../../assets/mascot.png';
import './DesktopPetPage.css';
import { MessageOutlined } from '@ant-design/icons';
import { Button } from 'antd';

export const DesktopPetPage = () => {
  const [busy, setBusy] = useState(false);
  const [bubble, setBubble] = useState<string>('');

  useEffect(() => {
    const prevBackground = document.body.style.background;
    const prevOverflow = document.body.style.overflow;
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.background = prevBackground;
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    const off = window.assistantApi.pet.onBubble((text) => {
      setBubble(text);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setBubble(''), 5000);
    });
    return () => {
      off();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleOpenChat = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await window.assistantApi.pet.openChat();
    } finally {
      window.setTimeout(() => setBusy(false), 350);
    }
  };

  return (
    <div className="desktop-pet-root">
      {bubble ? <div className="desktop-pet-bubble">{bubble}</div> : null}
      <img className="desktop-pet-avatar" src={mascotImage} alt="拉文杜拉桌宠" draggable={false} />
      <Button icon={<MessageOutlined />} className="desktop-pet-chat-btn" onClick={() => void handleOpenChat()} title="打开对话" />
    </div>
  );
};
