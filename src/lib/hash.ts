import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string, saltRounds = 10) => {
  const salt = bcrypt.genSaltSync(saltRounds);
  const hash = bcrypt.hashSync(password, salt);
  return { hash, salt };
};

export const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compareSync(password, hash);
};
