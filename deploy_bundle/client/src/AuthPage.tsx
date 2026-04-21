import React, { useState } from 'react';
import { Card, Form, Input, Button, Tabs, message, Space, Typography, Checkbox, Layout } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from './context/AuthContext';
import { login as apiLogin, register as apiRegister } from './api/auth';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

const AuthPage: React.FC = () => {
  const { login: authLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const data = await apiLogin(values.username, values.password);
      authLogin(data.token, data.user);
      message.success('登录成功，欢迎回来');
      
      // If remember me is checked, browser will handle most of password saving if standard fields are used
      // Session persistence is already handled by AuthContext via localStorage of the JWT token.
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.error || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      await apiRegister(values.username, values.password, values.name);
      message.success('账户注册成功！现在可以登录了');
      setActiveTab('login');
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.error || '注册失败，该用户名可能已被占用');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#fcfcfc',
      backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
      backgroundSize: '32px 32px',
      position: 'relative',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ 
          width: 72, 
          height: 72, 
          background: '#f29700', 
          borderRadius: 16, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(242,151,0,0.3)',
        }}>
          <SafetyCertificateOutlined style={{ fontSize: 36, color: '#fff' }} />
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, color: '#000', margin: '0 0 4px', letterSpacing: '-1px' }}>StatLab</h1>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          The Smart Way to Industrial Analytics
        </p>
      </div>

      <Card 
        bordered={false} 
        style={{ 
          width: 440, 
          boxShadow: '0 30px 60px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.1)', 
          borderRadius: 24,
          background: '#fff',
          padding: '24px 12px'
        }}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          indicator={{ size: 40 }}
          style={{ marginBottom: 20 }}
          tabBarStyle={{ borderBottom: '1px solid #f1f1f1' }}
        >
          <Tabs.TabPane tab={<span style={{ padding: '0 8px', fontWeight: 800, fontSize: 13, color: activeTab === 'login' ? '#914d1a' : '#999' }}>登录</span>} key="login">
            <Form onFinish={onLogin} layout="vertical" initialValues={{ remember: true }}>
              <Form.Item 
                label={<span style={{ fontSize: 10, fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username or ID</span>}
                name="username" 
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input 
                  prefix={<UserOutlined style={{ color: '#333', marginRight: 8 }} />} 
                  placeholder="Enter your credentials" 
                  size="large" 
                  style={{ borderRadius: 12, height: 50, background: '#e5e7eb', border: 'none', fontWeight: 500 }} 
                />
              </Form.Item>
              <Form.Item 
                label={<span style={{ fontSize: 10, fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</span>}
                name="password" 
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password 
                  prefix={<LockOutlined style={{ color: '#333', marginRight: 8 }} />} 
                  placeholder="••••••••" 
                  size="large" 
                  style={{ borderRadius: 12, height: 50, background: '#e5e7eb', border: 'none', fontWeight: 500 }} 
                />
              </Form.Item>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: -8 }}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox style={{ fontSize: 11, fontWeight: 600, color: '#661' }}>Remember me</Checkbox>
                </Form.Item>
                <a style={{ fontSize: 11, fontWeight: 700, color: '#914d1a' }}>Forgot password?</a>
              </div>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  size="large" 
                  loading={loading}
                  style={{ 
                    borderRadius: 12, 
                    height: 56, 
                    fontWeight: 900, 
                    fontSize: 18,
                    background: '#1a1c1e',
                    border: 'none',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.2)'
                  }}
                >
                  即刻登录
                </Button>
              </Form.Item>
              
              <div style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: 800, color: '#bdc3c7', letterSpacing: '0.1em' }}>SECURE GATEWAY</Text>
              </div>
            </Form>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab={<span style={{ padding: '0 8px', fontWeight: 800, fontSize: 13, color: activeTab === 'register' ? '#914d1a' : '#999' }}>注册</span>} key="register">
            <Form onFinish={onRegister} layout="vertical">
              <Form.Item 
                label={<span style={{ fontSize: 10, fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User UID</span>}
                name="username" 
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input prefix={<UserOutlined style={{ color: '#333' }} />} placeholder="唯一标识" size="large" style={{ borderRadius: 12, height: 48, background: '#f3f4f6', border: 'none' }} />
              </Form.Item>
              <Form.Item 
                label={<span style={{ fontSize: 10, fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display Name</span>}
                name="name" 
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input prefix={<MailOutlined style={{ color: '#333' }} />} placeholder="显示姓名" size="large" style={{ borderRadius: 12, height: 48, background: '#f3f4f6', border: 'none' }} />
              </Form.Item>
              <Form.Item 
                label={<span style={{ fontSize: 10, fontWeight: 800, color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Key</span>}
                name="password" 
                rules={[{ required: true, min: 6, message: '密码至少6位' }]}
              >
                <Input.Password prefix={<LockOutlined style={{ color: '#333' }} />} placeholder="设置密码" size="large" style={{ borderRadius: 12, height: 48, background: '#f3f4f6', border: 'none' }} />
              </Form.Item>
              <Form.Item style={{ marginTop: 20 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  size="large" 
                  loading={loading} 
                  style={{ 
                    borderRadius: 12, 
                    height: 52, 
                    fontWeight: 800, 
                    fontSize: 15,
                    background: '#f29700',
                    border: 'none',
                    boxShadow: '0 10px 20px rgba(242,151,0,0.15)'
                  }}
                >
                  创建分析员账户
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#666' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c853' }} />
            SERVER: ONLINE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#666' }}>
            <LockOutlined style={{ fontSize: 12 }} />
            SSL: ACTIVE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#666' }}>
            <SafetyCertificateOutlined style={{ fontSize: 12 }} />
            V 2.4.0
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16 }}>
          {['PRIVACY POLICY', 'SECURITY STANDARDS', 'SUPPORT'].map(link => (
            <a key={link} style={{ fontSize: 10, fontWeight: 800, color: '#333', letterSpacing: '0.05em' }}>{link}</a>
          ))}
        </div>

        <Text style={{ fontSize: 9, fontWeight: 700, color: '#bdc3c7', letterSpacing: '0.05em' }}>
          © 2024 STATLAB KINETIC ENGINE. PRECISION INDUSTRIAL ANALYSIS.
        </Text>
      </div>
    </div>
  );
};

export default AuthPage;
