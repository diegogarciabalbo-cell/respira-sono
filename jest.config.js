/** Testes de domínio e banco em Node (sem React Native). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json', diagnostics: { warnOnly: false } }] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
};
