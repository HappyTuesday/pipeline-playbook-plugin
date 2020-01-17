The pipeline-playbook-core is a script engine which will parse and execute another provided script project called deploy.config, in which the actual compiling & deploying progress logic is defined.

## The Deploy Config Project

Project deploy.config contains following information:

* Environment  
  An environment is a structure which contains some environment specific variables(configurations like db passwords, external resource urls etc) and all servers in this environment. For example, test / stage/ prod env.

* Playbook  
  A playbook is a list of plays which themself contain a list of tasks in which the actual compiling, verifying and deploying logic are defined. The task is just a groovy closure.

* Project  
  A project is a structure that normally relates to a business git repository containing the source code. A project contains a project name, some project specified variables, and metadata. Every project can select a playbook as its compiling & deploying method.

## How the Engine Works

The pipeline-playbook-core loads and parses the deploy.config project to determine all the information(environments, playbooks and projects), and for every project in every environment we generate a job.

A generated job means a project in a specified environment.

The generated jobs will be shown at your Jenkins home page. If you want to deploy one project in an environment, just navigate to the corresponding job and click the build button of that job(some defined parameters can be input).

Once a job is executed, the corresponding job of the corresponding project will be executed, which means all the plays defined in that playbook will be executed, which means all tasks defined in that plays will be executed. In each task, the variables(configurations) defined in the corresponding environment and project are available to the groovy closure of that task.