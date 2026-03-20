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
      background: 'linear-gradient(135deg, #1a1c1e 0%, #2d3436 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,165,0,0.05)', filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -50, right: -50, width: 300, height: 300, borderRadius: '50%', background: 'rgba(0,184,212,0.03)', filter: 'blur(60px)' }} />

      <Card 
        bordered={false} 
        style={{ 
          width: 440, 
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)', 
          borderRadius: 24,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          padding: '20px 10px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, background: '#ffa500', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,165,0,0.3)' }}>
              <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#1a1c1e', letterSpacing: '-0.5px' }}>StatLab</Title>
          </div>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            工业多参数 AI 分析协同平台 <br />
            <Text style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>The Smart Way to Industrial Analytics</Text>
          </Paragraph>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          centered 
          indicator={{ size: (origin) => origin - 20 }}
          style={{ marginBottom: 10 }}
        >
          <Tabs.TabPane tab={<span style={{ padding: '0 20px', fontWeight: 600 }}>登录</span>} key="login">
            <Form onFinish={onLogin} layout="vertical" initialValues={{ remember: true }}>
              <Form.Item 
                label={<Text strong style={{ fontSize: 12 }}>用户名</Text>}
                name="username" 
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input prefix={<UserOutlined style={{ color: '#d1d5db' }} />} placeholder="用户名或 ID" size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item 
                label={<Text strong style={{ fontSize: 12 }}>密码</Text>}
                name="password" 
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined style={{ color: '#d1d5db' }} />} placeholder="您的账户密码" size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox style={{ fontSize: 12 }}>保存密码 (自动登录)</Checkbox>
                </Form.Item>
                <a style={{ fontSize: 12, color: '#ff9a00' }}>忘记密码?</a>
              </div>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  size="large" 
                  loading={loading}
                  style={{ 
                    borderRadius: 12, 
                    height: 50, 
                    fontWeight: 700, 
                    fontSize: 15,
                    background: '#1a1c1e',
                    border: 'none',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                  }}
                >
                  即刻登录
                </Button>
              </Form.Item>
              
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  默认测试账号: <Text code style={{ color: '#ff9a00', background: '#fff' }}>admin</Text> 密码: <Text code style={{ background: '#fff' }}>123456</Text>
                </Text>
              </div>
            </Form>
          </Tabs.TabPane>
          
          <Tabs.TabPane tab={<span style={{ padding: '0 20px', fontWeight: 600 }}>免费注册</span>} key="register">
            <Form onFinish={onRegister} layout="vertical">
              <Form.Item 
                label={<Text strong style={{ fontSize: 12 }}>用户名 (UID)</Text>}
                name="username" 
                rules={[{ required: true, message: '请输入喜欢的用户名' }]}
              >
                <Input prefix={<UserOutlined style={{ color: '#d1d5db' }} />} placeholder="用于登录的唯一标识" size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item 
                label={<Text strong style={{ fontSize: 12 }}>显示姓名</Text>}
                name="name" 
                rules={[{ required: true, message: '请输入您的真实显示姓名' }]}
              >
                <Input prefix={<MailOutlined style={{ color: '#d1d5db' }} />} placeholder="将在系统中显示的名称" size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item 
                label={<Text strong style={{ fontSize: 12 }}>设置密码</Text>}
                name="password" 
                rules={[{ required: true, min: 6, message: '请输入至少 6 位密码' }]}
              >
                <Input.Password prefix={<LockOutlined style={{ color: '#d1d5db' }} />} placeholder="极简 6 位及以上" size="large" style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item style={{ marginTop: 24 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block 
                  size="large" 
                  loading={loading} 
                  style={{ 
                    borderRadius: 12, 
                    height: 50, 
                    fontWeight: 700, 
                    fontSize: 15,
                    background: '#ff9a00',
                    border: 'none',
                    boxShadow: '0 10px 20px rgba(255,154,0,0.15)'
                  }}
                >
                  确认并同意协议注册
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPane>
        </Tabs>

        <div style={{ height: 1, background: '#f1f1f1', margin: '10px 0 20px' }} />
        <div style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 11, color: '#bdc3c7' }}>© 2024 Continental AG · All Rights Reserved</Text>
        </div>
      </Card>
    </div>
  );
};

export default AuthPage;
