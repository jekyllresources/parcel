// @flow
import type {
  Asset as IAsset,
  TransformerResult,
  DependencyOptions,
  Dependency,
  FilePath,
  File,
  Environment,
  JSONObject,
  AST,
  AssetOutput
} from '@parcel/types';
import md5 from '@parcel/utils/md5';
import config from '@parcel/utils/config';
import createDependency from './createDependency';

type AssetOptions = {
  id?: string,
  hash?: string,
  filePath: FilePath,
  type: string,
  code?: string,
  ast?: ?AST,
  dependencies?: Array<Dependency>,
  connectedFiles?: Array<File>,
  output?: AssetOutput,
  env: Environment,
  meta?: JSONObject
};

export default class Asset implements IAsset {
  id: string;
  hash: string;
  filePath: FilePath;
  type: string;
  code: string;
  ast: ?AST;
  dependencies: Array<Dependency>;
  connectedFiles: Array<File>;
  output: AssetOutput;
  env: Environment;
  meta: JSONObject;

  constructor(options: AssetOptions) {
    this.id =
      options.id ||
      md5(options.filePath + options.type + JSON.stringify(options.env));
    this.hash = options.hash || '';
    this.filePath = options.filePath;
    this.type = options.type;
    this.code = options.code || (options.output ? options.output.code : '');
    this.ast = options.ast || null;
    this.dependencies = options.dependencies
      ? options.dependencies.slice()
      : [];
    this.connectedFiles = options.connectedFiles
      ? options.connectedFiles.slice()
      : [];
    this.output = options.output || {code: this.code};
    this.env = options.env;
    this.meta = options.meta || {};
  }

  toJSON(): AssetOptions {
    // Exclude `code` and `ast` from cache
    return {
      id: this.id,
      hash: this.hash,
      filePath: this.filePath,
      type: this.type,
      dependencies: this.dependencies,
      connectedFiles: this.connectedFiles,
      output: this.output,
      env: this.env,
      meta: this.meta
    };
  }

  addDependency(opts: DependencyOptions) {
    let dep = createDependency(
      {
        ...opts,
        env: mergeEnvironment(this.env, opts.env)
      },
      this.filePath
    );

    this.dependencies.push(dep);
    return dep.id;
  }

  async addConnectedFile(file: File) {
    if (!file.hash) {
      file.hash = await md5.file(file.filePath);
    }

    this.connectedFiles.push(file);
  }

  createChildAsset(result: TransformerResult) {
    let code = result.code || (result.output && result.output.code) || '';
    let opts: AssetOptions = {
      hash: this.hash || md5(code),
      filePath: this.filePath,
      type: result.type,
      code,
      ast: result.ast,
      env: mergeEnvironment(this.env, result.env),
      dependencies: this.dependencies,
      connectedFiles: this.connectedFiles,
      meta: Object.assign({}, this.meta, result.meta)
    };

    let asset = new Asset(opts);

    if (result.dependencies) {
      for (let dep of result.dependencies) {
        asset.addDependency(dep);
      }
    }

    if (result.connectedFiles) {
      for (let file of result.connectedFiles) {
        asset.addConnectedFile(file);
      }
    }

    return asset;
  }

  async getOutput() {
    return this.output;
  }

  async getConfig(filePaths: Array<FilePath>) {
    return config.load(this.filePath, filePaths);
  }

  async getPackage() {
    return {
      name: 'foo',
      version: '1.2.3'
    };
  }
}

function mergeEnvironment(a: Environment, b: ?Environment): Environment {
  return Object.assign({}, a, b);
}