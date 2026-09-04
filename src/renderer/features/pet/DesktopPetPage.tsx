import { useEffect, useState } from 'react';
import angryImage from '../../assets/angry.png';
import doubtImage from '../../assets/judge.png';
import rebuttalImage from '../../assets/disagree.png';
import worryImage from '../../assets/warried.png';
import happyImage from '../../assets/happy.png';
import cuteImage from '../../assets/cute.png';
import calmImage from '../../assets/usual.png';
import sadImage from '../../assets/sad.png';
import './DesktopPetPage.css';
import { MessageOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { AssistantEmotion } from '../../../shared/types/emotion';

const PET_FACE_BY_EMOTION: Record<AssistantEmotion, string> = {
  angry: angryImage,
  doubt: doubtImage,
  rebuttal: rebuttalImage,
  worry: worryImage,
  happy: happyImage,
  cute: cuteImage,
  calm: calmImage,
  sad: sadImage,
};

const EMOTION_RESET_MS = 15000;
const AVATAR_FADE_MS = 220;

export const DesktopPetPage = () => {
  const [busy, setBusy] = useState(false);
  const [bubble, setBubble] = useState<string>('');
  const [currentAvatar, setCurrentAvatar] = useState<string>(calmImage);
  const [fadingAvatar, setFadingAvatar] = useState<string | null>(null);

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

  useEffect(() => {
    let resetTimer: number | null = null;
    let fadeTimer: number | null = null;
    const switchAvatar = (nextAvatar: string) => {
      setCurrentAvatar((prevAvatar) => {
        if (prevAvatar === nextAvatar) return prevAvatar;
        setFadingAvatar(prevAvatar);
        if (fadeTimer) window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(() => setFadingAvatar(null), AVATAR_FADE_MS);
        return nextAvatar;
      });
    };
    const off = window.assistantApi.pet.onEmotion((emotion) => {
      const nextAvatar = PET_FACE_BY_EMOTION[emotion] ?? calmImage;
      switchAvatar(nextAvatar);
      if (resetTimer) window.clearTimeout(resetTimer);
      // calm 不必再定时切回；其它情绪一段时间后回到平静脸
      if (emotion !== 'calm') {
        resetTimer = window.setTimeout(() => switchAvatar(calmImage), EMOTION_RESET_MS);
      }
    });
    return () => {
      off();
      if (resetTimer) window.clearTimeout(resetTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
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
      <div className="desktop-pet-avatar-wrap">
        <img className="desktop-pet-avatar" src={currentAvatar} alt="拉文杜拉桌宠" draggable={false} />
        {fadingAvatar ? (
          <img
            className="desktop-pet-avatar desktop-pet-avatar--fade-out"
            src={fadingAvatar}
            alt="拉文杜拉桌宠"
            draggable={false}
          />
        ) : null}
      </div>
      <Button icon={<MessageOutlined />} className="desktop-pet-chat-btn" onClick={() => void handleOpenChat()} title="打开对话" />
    </div>
  );
};
