/** 生成 N 位数字提取码（默认 4 位） */
export function generateCode(length = 4): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }
  return code
}
