import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

export const login = async (req: Request, res: Response) => {
  try {
    const rawInput = (req.body.email || req.body.username || '').trim();
    const password = req.body.password;

    if (!rawInput || !password) {
      return res.status(400).json({ message: 'Email/Username and password are required' });
    }

    // Try finding user by exact email, case-insensitive, or username prefix (e.g. "admin" if "admin@panchawati.com")
    const usernamePrefix = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: rawInput },
          { email: rawInput.toLowerCase() },
          { email: usernamePrefix },
          { email: usernamePrefix.toLowerCase() }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: error?.message || 'Database connection error during login',
      error: error?.name || 'ServerError'
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    
    const userCount = await prisma.user.count();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRole = userCount === 0 ? 'Admin' : (role || 'Staff');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: userRole
      }
    });

    return res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ 
      message: error?.message || 'Database connection error during registration',
      error: error?.name || 'ServerError'
    });
  }
};
